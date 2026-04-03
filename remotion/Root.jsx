import { Composition } from 'remotion';
import { WorldCup } from './WorldCup';
import { TikTokWorldCup } from './TikTokWorldCup';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WorldCup"
        component={WorldCup}
        durationInFrames={30 * 65}
        fps={30}
        width={2160}
        height={3840}
        defaultProps={{
          homeTeam: 'FRA',
          awayTeam: 'SEN',
          seed: 42,
          matchInfo: 'Group I | 16 Jun | New York',
        }}
      />
      <Composition
        id="TikTokWorldCup"
        component={TikTokWorldCup}
        durationInFrames={30 * 65}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          homeTeam: 'FRA',
          awayTeam: 'SEN',
          seed: 42,
        }}
      />
    </>
  );
};
