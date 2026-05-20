interface SeverityProps {
  level: 1 | 2 | 3 | 4 | 5;
}

export const Severity = ({ level }: SeverityProps) => (
  <span className={`sev s${level}`}>
    <i />
    <i />
    <i />
    <i />
    <i />
  </span>
);
