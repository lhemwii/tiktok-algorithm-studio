import { Composition } from 'remotion';
import { WorldCup } from './WorldCup';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WorldCup"
        component={WorldCup}
        durationInFrames={30 * 65} // 65 seconds at 30fps
        fps={30}
        width={2160}
        height={3840}
      />
    </>
  );
};
