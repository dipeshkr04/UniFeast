import { HiOutlineCheckCircle } from 'react-icons/hi';
import { getBadgeAsset, NUTRITION_BADGES } from '../../constants/nutritionBadges';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

export default function RankProgressSummary({ userStats, badgeTiers = NUTRITION_BADGES }) {
  const currentBadge = userStats?.badge || badgeTiers[0];
  const nextBadge = userStats?.nextBadge;
  const shownBadge = nextBadge || currentBadge;
  const badgeProgress = userStats?.badgeProgress || {};
  const xpMeter = nextBadge?.xp ? Math.min(((userStats?.totalXP || 0) / nextBadge.xp) * 100, 100) : 100;

  return (
    <section className="leaderboard-progress-grid nutrition-rank-progress">
      <div className="rank-user-panel">
        <div className="rank-user-media">
          <span className="rank-pill">Your Rank</span>
          <img
            src={getBadgeAsset(currentBadge)}
            alt={`${currentBadge?.name || 'Begin'} badge`}
            className="rank-user-badge-image"
          />
        </div>

        <div className="rank-user-copy">
          <p className="rank-user-number">#{userStats?.rank || '-'}</p>
          <div className="rank-user-name">
            <span>{userStats?.name || 'Student'}</span>
            <HiOutlineCheckCircle className="w-4 h-4 text-primary-500" />
          </div>
          <p className="rank-user-score-label">Progress Score</p>
          <p className="rank-user-score">{formatNumber(userStats?.rankScore)}</p>
        </div>

        <div className="rank-user-stats">
          <div className="rank-stat-line">
            <span>Consistency</span>
            <strong>{userStats?.consistency || 0}%</strong>
          </div>
          <div className="rank-progress-bar"><span style={{ width: `${userStats?.consistency || 0}%` }} /></div>

          <div className="rank-stat-line">
            <span>XP Earned</span>
            <strong>{formatNumber(userStats?.totalXP)}</strong>
          </div>
          <div className="rank-progress-bar"><span style={{ width: `${xpMeter}%` }} /></div>

          <div className="rank-stat-line">
            <span>Adherence</span>
            <strong>{userStats?.adherence || 0}%</strong>
          </div>
          <div className="rank-progress-bar"><span style={{ width: `${userStats?.adherence || 0}%` }} /></div>
        </div>
      </div>

      <div className="next-badge-panel">
        <div>
          <p className="section-kicker">Next Badge</p>
          <h3>{nextBadge ? nextBadge.name : 'Thrive Secured'}</h3>
          <p className="next-badge-copy">
            {nextBadge
              ? `${nextBadge.days} consistent days, ${formatNumber(nextBadge.xp)} XP, ${nextBadge.adherence}% adherence required.`
              : 'You have reached the top badge tier.'}
          </p>
        </div>

        <div className="next-badge-main">
          <img src={getBadgeAsset(shownBadge)} alt={`${shownBadge?.name || 'Badge'} badge`} className="next-badge-image" />
          <div className="next-badge-meter">
            <div className="rank-progress-bar rank-progress-bar-large">
              <span style={{ width: `${badgeProgress.overall || 0}%` }} />
            </div>
            <p>{badgeProgress.overall || 0}% complete</p>
          </div>
        </div>

        <div className="badge-tier-rail">
          {badgeTiers.map((tier) => (
            <div className={`badge-tier-item ${currentBadge?.id === tier.id ? 'is-current' : ''}`} key={tier.id}>
              <img src={getBadgeAsset(tier)} alt={`${tier.name} badge`} />
              <span>{tier.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
