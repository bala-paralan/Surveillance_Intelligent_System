// Default recommended-action strings for the Threat Detail Drawer.
//
// Per TASK-043 §14 Q6, the playbook authorship policy is open. These are
// first-pass defaults — when an AOI has a configured policy, the threat
// itself carries `recommended_action`, which takes precedence.

import type { Classification, Threat } from '@shared/types';

const DEFAULT_BY_CLASSIFICATION: Record<Classification, string> = {
  tunneling:         'Dispatch ground team to verify and contain. Notify command immediately.',
  footsteps_single:  'Track via PTZ if available. Verify identity before engaging.',
  footsteps_group:   'Verify visually. Escalate to supervisor and prepare intercept.',
  group_presence:    'Verify visually. Escalate to supervisor.',
  human_presence:    'Track via PTZ if available. Verify before action.',
  vehicle:           'Verify visually. Coordinate intercept route.',
  engine:            'Cross-check with thermal/visual. Track approach vector.',
  voices:            'Confirm bearing. Cross-check with thermal/visual.',
  gunshot:           'Immediate response. Notify command and request medical standby.',
  generator:         'Investigate fixed source. Possible encampment.',
  livestock:         'Likely benign. Log and monitor for accompanying human activity.',
  animal:            'No action required. Log and monitor.',
  hot_spot:          'Cross-check with visual. Possible encampment or vehicle.',
  intrusion:         'Verify breach point. Dispatch nearest team.',
  tripwire_crossing: 'Verify crossing direction. Dispatch nearest team.',
  drone:             'Track and identify. Notify command.',
  object_unknown:    'Manual review required.',
  ambient:           'No action required.',
};

export const recommendedActionFor = (threat: Threat): string => {
  if (threat.recommended_action !== undefined && threat.recommended_action !== '') {
    return threat.recommended_action;
  }
  return DEFAULT_BY_CLASSIFICATION[threat.classification];
};
