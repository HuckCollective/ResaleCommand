// Standard Code 128 Table B patterns (107 patterns)
// Each pattern is encoded as 6 digits representing bar and space widths (total 11 modules), except STOP which is 7 digits (13 modules).
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (104=StartB, 106=Stop)
];

export function generateCode128Svg(text: string, options: { height?: number; barWidth?: number; includeText?: boolean } = {}): string {
  const height = options.height || 40;
  const barWidth = options.barWidth || 2;
  const includeText = options.includeText !== false;

  // Clean input text
  const clean = text.trim();
  if (!clean) return '';

  // Use Code 128 Set B (ASCII 32 to 126)
  const START_B = 104;
  const STOP = 106;

  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const code = charCode - 32;
    if (code < 0 || code > 95) {
      // replace unsupported with space
      codes.push(0);
      checksum += 0 * (i + 1);
    } else {
      codes.push(code);
      checksum += code * (i + 1);
    }
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP);

  // Convert widths into binary bars
  let modules = '';
  for (let i = 0; i < codes.length; i++) {
    const pattern = CODE128_PATTERNS[codes[i]];
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      modules += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  }

  const totalWidth = modules.length * barWidth;
  const totalHeight = includeText ? height + 16 : height;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let m = 0; m < modules.length; m++) {
    if (modules[m] === '1') {
      if (!inBar) {
        inBar = true;
        barStart = m;
      }
    } else {
      if (inBar) {
        inBar = false;
        const w = (m - barStart) * barWidth;
        rects += `<rect x="${barStart * barWidth}" y="0" width="${w}" height="${height}" fill="black" />`;
      }
    }
  }
  if (inBar) {
    const w = (modules.length - barStart) * barWidth;
    rects += `<rect x="${barStart * barWidth}" y="0" width="${w}" height="${height}" fill="black" />`;
  }

  const textElement = includeText 
    ? `<text x="${totalWidth / 2}" y="${height + 12}" font-family="monospace, monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="black">${clean}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="max-width: 100%; display: block; margin: 0 auto;">
    <rect width="${totalWidth}" height="${totalHeight}" fill="white" />
    ${rects}
    ${textElement}
  </svg>`;
}
