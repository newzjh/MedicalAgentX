import { useState, useEffect } from 'react';

/**
 * Custom hook to detect screen orientation (portrait or landscape)
 * @returns {object} An object with the current orientation and isPortrait/isLandscape booleans
 */
export default function useOrientation() {
  // Initial state based on current window dimensions
  const [orientation, setOrientation] = useState({
    isPortrait: window.innerHeight > window.innerWidth,
    isLandscape: window.innerWidth >= window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    // Handler to update orientation state when window is resized
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;
      const isLandscape = width >= height;

      setOrientation({
        isPortrait,
        isLandscape,
        width,
        height
      });
    };

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return orientation;
}