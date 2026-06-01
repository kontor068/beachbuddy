import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scanTargets = [
  path.join(rootDir, 'services', 'beachService.ts'),
  path.join(rootDir, 'public', 'data', 'beaches'),
];

const riskyPatterns = [
  {
    label: 'calm water',
    pattern: /\bcalm water\b/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'calm waters',
    pattern: /\bcalm waters\b/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'sheltered water',
    pattern: /\bsheltered waters?\b/iu,
    severity: 'medium',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'sheltered beach',
    pattern: /\bsheltered beach\b/iu,
    severity: 'medium',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'protected water',
    pattern: /\bprotected waters?\b/iu,
    severity: 'high',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'protected from wind',
    pattern: /\bprotected from (?:the )?(?:(?:north|northerly|northern|south|southerly|southern|east|easterly|eastern|west|westerly|western|northeast|northwest|southeast|southwest|ne|nw|se|sw)\s+)?winds?\b/iu,
    severity: 'high',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'safe swimming',
    pattern: /\bsafe swimming\b/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'safest',
    pattern: /\bsafest\b/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'perfect for swimming',
    pattern: /\bperfect for swimming\b/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'ideal for swimming',
    pattern: /\bideal for swimming\b/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'windless',
    pattern: /\bwindless\b/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'no waves',
    pattern: /\bno waves\b/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'ήρεμα νερά',
    pattern: /ήρεμα νερά/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'ήρεμη θάλασσα',
    pattern: /ήρεμη θάλασσα/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
  {
    label: 'προστατευμένα νερά',
    pattern: /προστατευμένα νερά/iu,
    severity: 'high',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'προστατευμένη από τον άνεμο',
    pattern: /προστατευμένη από τον άνεμο/iu,
    severity: 'high',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'απάνεμη',
    pattern: /απάνεμη/iu,
    severity: 'high',
    recommendation: 'move to windProfile/local expert note',
  },
  {
    label: 'ασφαλής για κολύμπι',
    pattern: /ασφαλής για κολύμπι/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'χωρίς κύμα',
    pattern: /χωρίς κύμα/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'χωρίς αέρα',
    pattern: /χωρίς αέρα/iu,
    severity: 'high',
    recommendation: 'rewrite',
  },
  {
    label: 'ιδανική για κολύμπι',
    pattern: /ιδανική για κολύμπι/iu,
    severity: 'medium',
    recommendation: 'rewrite',
  },
];

const safeEcologicalPatterns = [
  /Natura\s*2000/iu,
  /Caretta/iu,
  /\bprotected\s+(habitat|wetland|landscape)\b/iu,
  /προστατευόμεν(?:ος|η|ο)\s+(?:βιότοπος|περιοχή|είδος)/iu,
];

function isProtectionClaim(label) {
  return /protected|προστατευ|απάνεμη/iu.test(label);
}

function isSafeEcologicalContext(text) {
  return safeEcologicalPatterns.some((pattern) => pattern.test(text));
}

function shouldIgnoreFinding(text, patternInfo) {
  return isProtectionClaim(patternInfo.label) && isSafeEcologicalContext(text);
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

function lineNumberForIndex(text, index) {
  if (index < 0) {
    return null;
  }

  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function findLineForValue(fileText, value) {
  const index = fileText.indexOf(value);
  return lineNumberForIndex(fileText, index);
}

function trimSnippet(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 180) {
    return compact;
  }
  return `${compact.slice(0, 177)}...`;
}

function formatItemId(context) {
  if (!context.itemId && !context.itemName) {
    return '';
  }

  const parts = [];
  if (context.itemId) {
    parts.push(`id=${context.itemId}`);
  }
  if (context.itemName) {
    parts.push(`name=${context.itemName}`);
  }
  return parts.join(', ');
}

async function collectJsonFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }

  return files;
}

async function collectScanFiles() {
  const files = [];

  for (const target of scanTargets) {
    try {
      const targetStat = await stat(target);
      if (targetStat.isDirectory()) {
        files.push(...await collectJsonFiles(target));
      } else if (targetStat.isFile()) {
        files.push(target);
      }
    } catch {
      // Optional targets may not exist in every checkout.
    }
  }

  return [...new Set(files)].sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
}

function scanTextValue({ filePath, value, line, getLine, jsonPath, itemContext }) {
  const findings = [];

  for (const patternInfo of riskyPatterns) {
    patternInfo.pattern.lastIndex = 0;
    const match = patternInfo.pattern.exec(value);
    if (!match || shouldIgnoreFinding(value, patternInfo)) {
      continue;
    }

    findings.push({
      file: relativePath(filePath),
      line: typeof getLine === 'function' ? getLine() : line,
      item: formatItemId(itemContext),
      jsonPath,
      phrase: match[0],
      severity: patternInfo.severity,
      recommendation: patternInfo.recommendation,
      context: trimSnippet(value),
    });
  }

  return findings;
}

function scanPlainTextFile(filePath, fileText) {
  const findings = [];
  const lines = fileText.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    findings.push(...scanTextValue({
      filePath,
      value: lineText,
      line: index + 1,
      jsonPath: '',
      itemContext: {},
    }));
  });

  return findings;
}

function childItemContext(value, itemContext) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return itemContext;
  }

  return {
    itemId: value.id ?? itemContext.itemId,
    itemName: typeof value.name === 'string' ? value.name : itemContext.itemName,
  };
}

function scanJsonValue({ filePath, fileText, value, jsonPath = '$', itemContext = {} }) {
  if (typeof value === 'string') {
    return scanTextValue({
      filePath,
      value,
      getLine: () => findLineForValue(fileText, value),
      jsonPath,
      itemContext,
    });
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => scanJsonValue({
      filePath,
      fileText,
      value: entry,
      jsonPath: `${jsonPath}[${index}]`,
      itemContext: childItemContext(entry, itemContext),
    }));
  }

  if (value && typeof value === 'object') {
    const nextItemContext = childItemContext(value, itemContext);
    return Object.entries(value).flatMap(([key, entry]) => scanJsonValue({
      filePath,
      fileText,
      value: entry,
      jsonPath: `${jsonPath}.${key}`,
      itemContext: nextItemContext,
    }));
  }

  return [];
}

function scanJsonFile(filePath, fileText) {
  try {
    const json = JSON.parse(fileText);
    return scanJsonValue({ filePath, fileText, value: json });
  } catch {
    return scanPlainTextFile(filePath, fileText);
  }
}

function sortFindings(findings) {
  const severityRank = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const fileDelta = a.file.localeCompare(b.file);
    if (fileDelta !== 0) {
      return fileDelta;
    }
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

function printReport(scannedFiles, findings) {
  const counts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Static Beach Content Safety Audit');
  console.log(`Scanned files: ${scannedFiles.length}`);
  console.log(`Findings: ${findings.length} (high ${counts.high ?? 0}, medium ${counts.medium ?? 0}, low ${counts.low ?? 0})`);
  console.log('');

  if (findings.length === 0) {
    console.log('No risky static condition wording found outside ignored ecological/legal contexts.');
    return;
  }

  for (const finding of findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    console.log(`- ${finding.severity.toUpperCase()} ${location}`);
    if (finding.item) {
      console.log(`  item: ${finding.item}`);
    }
    if (finding.jsonPath) {
      console.log(`  path: ${finding.jsonPath}`);
    }
    console.log(`  matched: ${finding.phrase}`);
    console.log(`  recommendation: ${finding.recommendation}`);
    console.log(`  context: ${finding.context}`);
  }
}

async function main() {
  const files = await collectScanFiles();
  const findings = [];

  for (const filePath of files) {
    const fileText = await readFile(filePath, 'utf8');
    if (filePath.endsWith('.json')) {
      findings.push(...scanJsonFile(filePath, fileText));
    } else {
      findings.push(...scanPlainTextFile(filePath, fileText));
    }
  }

  printReport(files, sortFindings(findings));
}

main().catch((error) => {
  console.error('Static beach content audit failed to run.');
  console.error(error);
  process.exitCode = 0;
});
