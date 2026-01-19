// IRC formatting control characters
export const IRC_FORMAT = {
  BOLD: '\x02',
  ITALIC: '\x1D',
  UNDERLINE: '\x1F',
  STRIKETHROUGH: '\x1E',
  MONOSPACE: '\x11',
  COLOR: '\x03',
  HEX_COLOR: '\x04',
  REVERSE: '\x16',
  RESET: '\x0F',
} as const;

// Standard mIRC color palette (0-15)
const IRC_COLORS: Record<number, string> = {
  0: '#FFFFFF', // White
  1: '#000000', // Black
  2: '#00007F', // Blue (Navy)
  3: '#009300', // Green
  4: '#FF0000', // Red
  5: '#7F0000', // Brown (Maroon)
  6: '#9C009C', // Magenta (Purple)
  7: '#FC7F00', // Orange (Olive)
  8: '#FFFF00', // Yellow
  9: '#00FC00', // Light Green (Lime)
  10: '#009393', // Cyan (Teal)
  11: '#00FFFF', // Light Cyan (Aqua)
  12: '#0000FC', // Light Blue
  13: '#FF00FF', // Pink (Fuchsia)
  14: '#7F7F7F', // Grey
  15: '#D2D2D2', // Light Grey (Silver)
};

// Extended color palette (16-98)
const IRC_EXTENDED_COLORS: Record<number, string> = {
  16: '#470000', 17: '#472100', 18: '#474700', 19: '#324700', 20: '#004700', 21: '#00472c',
  22: '#004747', 23: '#002747', 24: '#000047', 25: '#2e0047', 26: '#470047', 27: '#47002a',
  28: '#740000', 29: '#743a00', 30: '#747400', 31: '#517400', 32: '#007400', 33: '#007449',
  34: '#007474', 35: '#004074', 36: '#000074', 37: '#4b0074', 38: '#740074', 39: '#740045',
  40: '#b50000', 41: '#b56300', 42: '#b5b500', 43: '#7db500', 44: '#00b500', 45: '#00b571',
  46: '#00b5b5', 47: '#0063b5', 48: '#0000b5', 49: '#7500b5', 50: '#b500b5', 51: '#b5006b',
  52: '#ff0000', 53: '#ff8c00', 54: '#ffff00', 55: '#b2ff00', 56: '#00ff00', 57: '#00ffa0',
  58: '#00ffff', 59: '#008cff', 60: '#0000ff', 61: '#a500ff', 62: '#ff00ff', 63: '#ff0098',
  64: '#ff5959', 65: '#ffb459', 66: '#ffff71', 67: '#cfff60', 68: '#6fff6f', 69: '#65ffc9',
  70: '#6dffff', 71: '#59b4ff', 72: '#5959ff', 73: '#c459ff', 74: '#ff66ff', 75: '#ff59bc',
  76: '#ff9c9c', 77: '#ffd39c', 78: '#ffff9c', 79: '#e2ff9c', 80: '#9cff9c', 81: '#9cffdb',
  82: '#9cffff', 83: '#9cd3ff', 84: '#9c9cff', 85: '#dc9cff', 86: '#ff9cff', 87: '#ff94d3',
  88: '#000000', 89: '#131313', 90: '#282828', 91: '#363636', 92: '#4d4d4d', 93: '#656565',
  94: '#818181', 95: '#9f9f9f', 96: '#bcbcbc', 97: '#e2e2e2', 98: '#ffffff',
};

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  monospace: boolean;
  reverse: boolean;
  foreground: string | null;
  background: string | null;
}

export interface FormattedSegment {
  text: string;
  style: FormatState;
}

function getColorFromCode(code: number): string | null {
  if (code >= 0 && code <= 15) {
    return IRC_COLORS[code];
  }
  if (code >= 16 && code <= 98) {
    return IRC_EXTENDED_COLORS[code];
  }
  if (code === 99) {
    return null; // Default/transparent
  }
  return null;
}

function createDefaultState(): FormatState {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    monospace: false,
    reverse: false,
    foreground: null,
    background: null,
  };
}

function cloneState(state: FormatState): FormatState {
  return { ...state };
}

export function parseIrcFormatting(text: string): FormattedSegment[] {
  const segments: FormattedSegment[] = [];
  let currentState = createDefaultState();
  let currentText = '';
  let i = 0;

  const flushSegment = () => {
    if (currentText.length > 0) {
      segments.push({
        text: currentText,
        style: cloneState(currentState),
      });
      currentText = '';
    }
  };

  while (i < text.length) {
    const char = text[i];

    switch (char) {
      case IRC_FORMAT.BOLD:
        flushSegment();
        currentState.bold = !currentState.bold;
        i++;
        break;

      case IRC_FORMAT.ITALIC:
        flushSegment();
        currentState.italic = !currentState.italic;
        i++;
        break;

      case IRC_FORMAT.UNDERLINE:
        flushSegment();
        currentState.underline = !currentState.underline;
        i++;
        break;

      case IRC_FORMAT.STRIKETHROUGH:
        flushSegment();
        currentState.strikethrough = !currentState.strikethrough;
        i++;
        break;

      case IRC_FORMAT.MONOSPACE:
        flushSegment();
        currentState.monospace = !currentState.monospace;
        i++;
        break;

      case IRC_FORMAT.REVERSE:
        flushSegment();
        currentState.reverse = !currentState.reverse;
        i++;
        break;

      case IRC_FORMAT.RESET:
        flushSegment();
        currentState = createDefaultState();
        i++;
        break;

      case IRC_FORMAT.COLOR: {
        flushSegment();
        i++; // Skip the color control character

        // Parse foreground color (1-2 digits)
        let fgStr = '';
        // Read up to 2 digits for foreground
        if (i < text.length && /\d/.test(text[i])) {
          fgStr += text[i];
          i++;
          if (i < text.length && /\d/.test(text[i])) {
            fgStr += text[i];
            i++;
          }
        }

        if (fgStr.length > 0) {
          const fg = parseInt(fgStr, 10);
          currentState.foreground = getColorFromCode(fg);

          // Check for background color
          if (i < text.length && text[i] === ',') {
            i++; // Skip comma
            let bgStr = '';
            // Read up to 2 digits for background
            if (i < text.length && /\d/.test(text[i])) {
              bgStr += text[i];
              i++;
              if (i < text.length && /\d/.test(text[i])) {
                bgStr += text[i];
                i++;
              }
            }
            if (bgStr.length > 0) {
              const bg = parseInt(bgStr, 10);
              currentState.background = getColorFromCode(bg);
            }
          }
        } else {
          // Color code without numbers resets colors
          currentState.foreground = null;
          currentState.background = null;
        }
        break;
      }

      case IRC_FORMAT.HEX_COLOR: {
        flushSegment();
        i++; // Skip the hex color control character

        // Parse 6 hex digits for foreground
        if (i + 6 <= text.length && /^[0-9A-Fa-f]{6}$/.test(text.slice(i, i + 6))) {
          currentState.foreground = '#' + text.slice(i, i + 6);
          i += 6;

          // Check for background hex color
          if (i < text.length && text[i] === ',') {
            i++; // Skip comma
            if (i + 6 <= text.length && /^[0-9A-Fa-f]{6}$/.test(text.slice(i, i + 6))) {
              currentState.background = '#' + text.slice(i, i + 6);
              i += 6;
            }
          }
        }
        break;
      }

      default:
        currentText += char;
        i++;
        break;
    }
  }

  flushSegment();
  return segments;
}

export function hasIrcFormatting(text: string): boolean {
  const formatChars = Object.values(IRC_FORMAT);
  return formatChars.some((char) => text.includes(char));
}

export function stripIrcFormatting(text: string): string {
  // Remove all formatting codes
  let result = text;

  // Remove color codes with their arguments
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x03(\d{1,2}(,\d{1,2})?)?/g, '');

  // Remove hex color codes with their arguments
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x04([0-9A-Fa-f]{6}(,[0-9A-Fa-f]{6})?)?/g, '');

  // Remove all other format control characters
  const simpleFormatChars = [
    IRC_FORMAT.BOLD,
    IRC_FORMAT.ITALIC,
    IRC_FORMAT.UNDERLINE,
    IRC_FORMAT.STRIKETHROUGH,
    IRC_FORMAT.MONOSPACE,
    IRC_FORMAT.REVERSE,
    IRC_FORMAT.RESET,
  ];

  for (const char of simpleFormatChars) {
    result = result.split(char).join('');
  }

  return result;
}
