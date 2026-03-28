export const prebuiltAnimations = {
  fade: { opacity: [0, 1] },
  slide: { y: [20, 0], opacity: [0, 1] },
  scale: { scale: [0.95, 1], opacity: [0, 1] },
};

export async function generateMotionFromDescription(description: string) {
  // Mock generative motion (description -> keyframes)
  console.log(`Generating keyframes for: ${description}`);
  if (description.includes('bounce')) {
    return { y: [0, -20, 0], transition: { type: 'spring', bounce: 0.5 } };
  }
  return { opacity: [0, 1] };
}
