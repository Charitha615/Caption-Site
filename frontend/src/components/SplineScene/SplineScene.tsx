import React, { Suspense, lazy } from 'react';
import './SplineScene.css';

// The Spline runtime is large — load it only when a scene is actually rendered.
const Spline = lazy(() => import('@splinetool/react-spline'));

export interface SplineSceneProps {
  scene: string;
  className?: string;
}

export const SplineScene: React.FC<SplineSceneProps> = ({ scene, className }) => (
  <Suspense
    fallback={
      <div className="spline-scene-fallback" role="status" aria-label="Loading 3D scene">
        <span className="spline-scene-loader" />
      </div>
    }
  >
    <Spline scene={scene} className={className} />
  </Suspense>
);
