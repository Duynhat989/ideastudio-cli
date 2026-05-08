const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const metadataVersionPath = path.join(rootDir, 'metadata', 'version.json');

function parseSemver(input = '') {
  const match = String(input).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function main() {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const current = parseSemver(pkg.version);
  if (!current) {
    throw new Error(`Invalid package version: ${pkg.version}`);
  }

  const nextVersion = `${current.major}.${current.minor}.${current.patch + 1}`;
  pkg.version = nextVersion;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');

  let metadata = {
    app: {
      name: 'IdeaStudio',
      internalName: 'ideastudio-desktop',
      description: 'Desktop application for IdeaStudio',
      home: 'https://idea2vid.com',
      version: nextVersion,
    },
  };

  if (fs.existsSync(metadataVersionPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(metadataVersionPath, 'utf-8'));
      metadata = {
        ...parsed,
        app: {
          ...(parsed.app || {}),
          version: nextVersion,
        },
      };
    } catch (_) {
      // Keep fallback metadata payload when file content is invalid.
    }
  } else {
    fs.mkdirSync(path.dirname(metadataVersionPath), { recursive: true });
  }

  fs.writeFileSync(metadataVersionPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
  console.log(`[bump-version] ${current.major}.${current.minor}.${current.patch} -> ${nextVersion}`);
}

main();
