/**
 * RFM Segmentation Configuration
 */

import type { RFMSegment, DonorProfile } from './types';

export const RFM_SEGMENT_CONFIG: Record<
  DonorProfile['segment'],
  Omit<RFMSegment, 'donorCount' | 'totalAmount' | 'avgGift'>
> = {
  champion: {
    segment: 'champion',
    name: 'Champions',
    description: 'Recent, frequent, high-value donors',
    emoji: '🏆',
    strategy: 'Thank, recognize, exclusive access',
  },
  loyal: {
    segment: 'loyal',
    name: 'Loyal Donors',
    description: 'Regular mid-level contributors',
    emoji: '💎',
    strategy: 'Upgrade asks, monthly giving programs',
  },
  potential: {
    segment: 'potential',
    name: 'Potential Loyalists',
    description: 'Recent donors, not yet frequent',
    emoji: '⭐',
    strategy: 'Nurture, welcome series, second gift',
  },
  at_risk: {
    segment: 'at_risk',
    name: 'At Risk',
    description: "Were valuable, haven't given recently",
    emoji: '⚠️',
    strategy: 'Reactivation campaigns, special appeals',
  },
  lapsed: {
    segment: 'lapsed',
    name: 'Lapsed',
    description: "Haven't given in 12+ months",
    emoji: '💤',
    strategy: 'Win-back campaigns, updated messaging',
  },
  prospect: {
    segment: 'prospect',
    name: 'Prospects',
    description: 'High-capacity area, no donation history',
    emoji: '🎯',
    strategy: 'Acquisition, events, peer-to-peer',
  },
};
