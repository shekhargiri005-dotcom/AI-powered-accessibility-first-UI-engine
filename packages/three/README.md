# @ui/three

3D WebGL components based on Three.js (React Three Fiber).
Lazy-loadable with WebGPU fallbacks.

## Installation
```ts
import { Scene3D, AnimatedModel, ParticleSystem } from '@ui/three';
```

## Usage
```tsx
<Scene3D>
  <AnimatedModel url="/models/robot.glb" />
  <ParticleSystem count={5000} />
</Scene3D>
```
