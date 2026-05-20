"""
Acoustic feature extraction.

Computes a 40-bin MFCC feature vector plus log-energy using scipy,
giving a total 41-dimensional feature vector.  Avoids librosa to keep
dependencies minimal.

Privacy note: these features are spectral envelopes only — they cannot be
used to reconstruct speech.  The classifier must not attempt transcription.
"""
from __future__ import annotations

import logging
import math

import numpy as np

logger = logging.getLogger(__name__)

# MFCC parameters
_N_MFCC = 40
_N_FFT = 512
_N_MELS = 40
_FMIN = 0.0
_FMAX_FRACTION = 0.5  # Nyquist


def _hz_to_mel(hz: float) -> float:
    return 2595.0 * math.log10(1.0 + hz / 700.0)


def _mel_to_hz(mel: float) -> float:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def _build_mel_filterbank(
    n_mels: int, n_fft: int, sample_rate: int
) -> np.ndarray:
    """Return an (n_mels, n_fft // 2 + 1) mel filterbank matrix."""
    fmax = sample_rate * _FMAX_FRACTION
    mel_min = _hz_to_mel(_FMIN)
    mel_max = _hz_to_mel(fmax)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = np.array([_mel_to_hz(m) for m in mel_points])

    # Map hz_points to FFT bin indices
    n_bins = n_fft // 2 + 1
    bin_points = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)
    bin_points = np.clip(bin_points, 0, n_bins - 1)

    filterbank = np.zeros((n_mels, n_bins))
    for m in range(1, n_mels + 1):
        f_left = bin_points[m - 1]
        f_centre = bin_points[m]
        f_right = bin_points[m + 1]

        for k in range(f_left, f_centre + 1):
            denom = f_centre - f_left
            filterbank[m - 1, k] = (k - f_left) / denom if denom > 0 else 0.0

        for k in range(f_centre, f_right + 1):
            denom = f_right - f_centre
            filterbank[m - 1, k] = (f_right - k) / denom if denom > 0 else 0.0

    return filterbank


def _dct_matrix(n_mels: int, n_mfcc: int) -> np.ndarray:
    """Return an (n_mfcc, n_mels) DCT-II matrix (orthonormal)."""
    i = np.arange(n_mfcc)[:, np.newaxis]
    j = np.arange(n_mels)[np.newaxis, :]
    mat = np.cos(math.pi / n_mels * (j + 0.5) * i)
    mat[0, :] *= 1.0 / math.sqrt(n_mels)
    mat[1:, :] *= math.sqrt(2.0 / n_mels)
    return mat


# Pre-build static matrices
_FILTERBANK: np.ndarray | None = None
_DCT_MAT: np.ndarray | None = None


def _get_filterbank(sample_rate: int) -> np.ndarray:
    global _FILTERBANK  # noqa: PLW0603
    if _FILTERBANK is None:
        _FILTERBANK = _build_mel_filterbank(_N_MELS, _N_FFT, sample_rate)
    return _FILTERBANK


def _get_dct() -> np.ndarray:
    global _DCT_MAT  # noqa: PLW0603
    if _DCT_MAT is None:
        _DCT_MAT = _dct_matrix(_N_MELS, _N_MFCC)
    return _DCT_MAT


def extract_features(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    Extract a 41-dimensional feature vector from a float32 audio frame.

    The vector consists of:
      - 40 MFCC coefficients (computed via scipy or fallback numpy)
      - 1 log-energy feature

    Parameters
    ----------
    audio:
        1-D float32 array of audio samples.
    sample_rate:
        Sample rate of the audio in Hz.

    Returns
    -------
    np.ndarray
        Shape ``(41,)``, dtype float32.
    """
    if len(audio) == 0:
        return np.zeros(_N_MFCC + 1, dtype=np.float32)

    # Log energy of the whole frame
    energy = float(np.sum(audio ** 2))
    log_energy = math.log(max(energy, 1e-10))

    try:
        mfcc = _compute_mfcc_scipy(audio, sample_rate)
    except Exception as exc:
        logger.warning("scipy MFCC computation failed, using numpy fallback: %s", exc)
        mfcc = _compute_mfcc_numpy(audio, sample_rate)

    features = np.concatenate([mfcc, [log_energy]]).astype(np.float32)
    return features


def _compute_mfcc_scipy(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Compute 40-bin MFCC using scipy spectrogram."""
    from scipy.signal import spectrogram  # type: ignore[import-untyped]

    _, _, Sxx = spectrogram(
        audio,
        fs=sample_rate,
        nperseg=_N_FFT,
        noverlap=_N_FFT // 2,
        window="hann",
    )

    # Average power spectrum across time frames
    power_spectrum = np.mean(Sxx, axis=1)  # shape: (n_fft // 2 + 1,)

    # Trim or pad to n_fft // 2 + 1 bins
    expected_bins = _N_FFT // 2 + 1
    if len(power_spectrum) < expected_bins:
        power_spectrum = np.pad(power_spectrum, (0, expected_bins - len(power_spectrum)))
    else:
        power_spectrum = power_spectrum[:expected_bins]

    filterbank = _get_filterbank(sample_rate)
    mel_energies = np.dot(filterbank, power_spectrum)
    log_mel = np.log(mel_energies + 1e-10)

    dct_mat = _get_dct()
    mfcc = np.dot(dct_mat, log_mel)
    return mfcc.astype(np.float32)


def _compute_mfcc_numpy(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Numpy-only fallback MFCC computation."""
    n = min(len(audio), _N_FFT)
    frame = audio[:n]
    window = np.hanning(n)
    windowed = frame * window
    fft_vals = np.fft.rfft(windowed, n=_N_FFT)
    power_spectrum = (np.abs(fft_vals) ** 2) / _N_FFT

    filterbank = _get_filterbank(sample_rate)
    mel_energies = np.dot(filterbank, power_spectrum)
    log_mel = np.log(mel_energies + 1e-10)

    dct_mat = _get_dct()
    mfcc = np.dot(dct_mat, log_mel)
    return mfcc.astype(np.float32)
