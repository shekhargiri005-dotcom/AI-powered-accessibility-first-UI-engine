export const colors = {
  primary: '#3B82F6',
  secondary: '#1F2937',
  background: '#0F172A',
  text: '#F8FAFC',
};

export const getContrastColor = (hexcode: string) => {
  // basic contrast utility
  return hexcode.startsWith('#0') ? '#FFFFFF' : '#000000';
};
