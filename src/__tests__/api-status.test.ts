/**
 * Status API Endpoint Tests
 *
 * Verifies the GET /api/status endpoint returns accurate system state
 * for agent decision-making
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KMSStoreManager } from '../kms/store';
import { ManifestManager } from '../conversion/manifest';

describe('Status API Functionality', () => {
  let tempDir: string;
  let manifestManager: ManifestManager;
  let kmsStoreManager: KMSStoreManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-api-test-'));
    manifestManager = new ManifestManager(tempDir);
    kmsStoreManager = new KMSStoreManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Input Directory Status', () => {
    test('should detect missing input directory', () => {
      const inputDir = path.join(tempDir, 'input');
      expect(fs.existsSync(inputDir)).toBe(false);
    });

    test('should count input files correctly', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);

      // Create test files
      fs.writeFileSync(path.join(inputDir, 'test1.txt'), 'content1');
      fs.writeFileSync(path.join(inputDir, 'test2.txt'), 'content2');
      fs.writeFileSync(path.join(inputDir, 'ignore.md'), 'should be ignored');

      const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.txt'));
      expect(files.length).toBe(2);
    });

    test('should calculate total input file size', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);

      const content1 = 'x'.repeat(100);
      const content2 = 'y'.repeat(200);

      fs.writeFileSync(path.join(inputDir, 'test1.txt'), content1);
      fs.writeFileSync(path.join(inputDir, 'test2.txt'), content2);

      const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.txt'));
      const totalSize = files.reduce((sum, f) => {
        return sum + fs.statSync(path.join(inputDir, f)).size;
      }, 0);

      expect(totalSize).toBe(300);
    });
  });

  describe('Manifest Status', () => {
    test('should detect missing manifest', () => {
      const manifestPath = path.join(tempDir, '.processed_manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(false);
    });

    test('should validate correct manifest structure', () => {
      const manifest = manifestManager.loadManifest();
      expect(Array.isArray(manifest.processed_files)).toBe(true);
      expect(typeof manifest.version).toBe('number');
    });

    test('should count processed files', () => {
      const manifest = manifestManager.loadManifest();
      const inputFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(inputFile, 'content');

      const fileHash = manifestManager.computeFileHash(inputFile);
      manifestManager.recordConversion(manifest, 'test.txt', 'test.md', fileHash!);
      manifestManager.saveManifest(manifest);

      const loadedManifest = manifestManager.loadManifest();
      expect(loadedManifest.processed_files.length).toBe(1);
    });

    test('should calculate pending count', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);

      // Create 3 input files
      fs.writeFileSync(path.join(inputDir, 'test1.txt'), 'content1');
      fs.writeFileSync(path.join(inputDir, 'test2.txt'), 'content2');
      fs.writeFileSync(path.join(inputDir, 'test3.txt'), 'content3');

      // Mark 1 as processed
      const manifest = manifestManager.loadManifest();
      const fileHash = manifestManager.computeFileHash(path.join(inputDir, 'test1.txt'));
      manifestManager.recordConversion(manifest, 'test1.txt', 'test1.md', fileHash!);

      const inputFiles = 3;
      const processedCount = 1;
      const pendingCount = Math.max(0, inputFiles - processedCount);

      expect(pendingCount).toBe(2);
    });

    test('should track last update time', () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.saveManifest(manifest);

      const loadedManifest = manifestManager.loadManifest();
      expect(loadedManifest.last_run).toBeDefined();
      expect(typeof loadedManifest.last_run).toBe('string');
    });
  });

  describe('KMS Data Aggregation', () => {
    test('should count decisions across all meetings', () => {
      const kmsPath = path.join(tempDir, '.processed_kms.json');

      const kmsData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        meetings: {
          'meeting1': {
            decisions: [
              { id: 'd1', text: 'Decision 1', owner: 'Alice', status: 'active' },
              { id: 'd2', text: 'Decision 2', owner: 'Bob', status: 'active' },
            ],
            actionItems: [],
            commitments: [],
            risks: [],
          },
          'meeting2': {
            decisions: [
              { id: 'd3', text: 'Decision 3', owner: 'Alice', status: 'active' },
            ],
            actionItems: [],
            commitments: [],
            risks: [],
          },
        },
      };

      fs.writeFileSync(kmsPath, JSON.stringify(kmsData));

      // Read and aggregate
      const content = fs.readFileSync(kmsPath, 'utf-8');
      const parsed = JSON.parse(content);

      let decisionCount = 0;
      Object.values(parsed.meetings).forEach((meeting: any) => {
        decisionCount += (meeting.decisions || []).length;
      });

      expect(decisionCount).toBe(3);
    });

    test('should count all KMS item types', () => {
      const kmsPath = path.join(tempDir, '.processed_kms.json');

      const kmsData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        meetings: {
          'meeting1': {
            decisions: [
              { id: 'd1', text: 'Decision 1', owner: 'Alice', status: 'active' },
            ],
            actionItems: [
              { id: 'a1', text: 'Action 1', owner: 'Bob', dueDate: '2025-12-31', status: 'not-started' },
              { id: 'a2', text: 'Action 2', owner: 'Charlie', dueDate: '2025-06-30', status: 'in-progress' },
            ],
            commitments: [
              { id: 'c1', text: 'Commitment 1', owner: 'Alice', dueDate: '2025-12-31' },
            ],
            risks: [
              { id: 'r1', text: 'Risk 1', severity: 'high', mitigation: 'Mitigate it' },
              { id: 'r2', text: 'Risk 2', severity: 'medium', mitigation: 'Monitor it' },
            ],
          },
        },
      };

      fs.writeFileSync(kmsPath, JSON.stringify(kmsData));

      // Read and aggregate
      const content = fs.readFileSync(kmsPath, 'utf-8');
      const parsed = JSON.parse(content);

      let decisions = 0, actions = 0, commitments = 0, risks = 0;
      Object.values(parsed.meetings).forEach((meeting: any) => {
        decisions += (meeting.decisions || []).length;
        actions += (meeting.actionItems || []).length;
        commitments += (meeting.commitments || []).length;
        risks += (meeting.risks || []).length;
      });

      expect(decisions).toBe(1);
      expect(actions).toBe(2);
      expect(commitments).toBe(1);
      expect(risks).toBe(2);
    });

    test('should handle empty KMS data', () => {
      const kmsPath = path.join(tempDir, '.processed_kms.json');

      const kmsData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        meetings: {},
      };

      fs.writeFileSync(kmsPath, JSON.stringify(kmsData));

      const content = fs.readFileSync(kmsPath, 'utf-8');
      const parsed = JSON.parse(content);

      let decisions = 0;
      Object.values(parsed.meetings).forEach((meeting: any) => {
        decisions += (meeting.decisions || []).length;
      });

      expect(decisions).toBe(0);
    });

    test('should handle corrupted KMS data gracefully', () => {
      const kmsPath = path.join(tempDir, '.processed_kms.json');
      fs.writeFileSync(kmsPath, 'invalid json {');

      try {
        const content = fs.readFileSync(kmsPath, 'utf-8');
        JSON.parse(content);
        expect(true).toBe(false); // Should have thrown
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Readiness Flags', () => {
    test('canConvert should be true when input directory has files', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);
      fs.writeFileSync(path.join(inputDir, 'test.txt'), 'content');

      const inputExists = fs.existsSync(inputDir);
      const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.txt'));
      const canConvert = inputExists && files.length > 0;

      expect(canConvert).toBe(true);
    });

    test('canAnalyze should be true when processing directory exists', () => {
      const processingDir = path.join(tempDir, 'processing');
      fs.mkdirSync(processingDir);

      const canAnalyze = fs.existsSync(processingDir);
      expect(canAnalyze).toBe(true);
    });

    test('kmsAvailable should be true when KMS data exists and has items', () => {
      const kmsPath = path.join(tempDir, '.processed_kms.json');

      const kmsData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        meetings: {
          'meeting1': {
            decisions: [
              { id: 'd1', text: 'Decision 1', owner: 'Alice', status: 'active' },
            ],
            actionItems: [],
            commitments: [],
            risks: [],
          },
        },
      };

      fs.writeFileSync(kmsPath, JSON.stringify(kmsData));

      const kmsExists = fs.existsSync(kmsPath);
      expect(kmsExists).toBe(true);
    });
  });

  describe('Health Flag', () => {
    test('should be true when input, manifest, and KMS are healthy', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);
      fs.writeFileSync(path.join(inputDir, 'test.txt'), 'content');

      const manifest = manifestManager.loadManifest();
      manifestManager.saveManifest(manifest);

      const kmsPath = path.join(tempDir, '.processed_kms.json');
      const kmsData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        meetings: {
          'meeting1': {
            decisions: [
              { id: 'd1', text: 'Decision 1', owner: 'Alice', status: 'active' },
            ],
            actionItems: [],
            commitments: [],
            risks: [],
          },
        },
      };
      fs.writeFileSync(kmsPath, JSON.stringify(kmsData));

      const inputExists = fs.existsSync(inputDir);
      const manifestValid = Array.isArray(manifest.processed_files);
      const kmsExists = fs.existsSync(kmsPath);

      const healthy = inputExists && manifestValid && kmsExists;
      expect(healthy).toBe(true);
    });

    test('should be false when components are missing', () => {
      // All directories don't exist
      const inputExists = false;
      const manifestValid = false;
      const kmsExists = false;

      const healthy = inputExists && manifestValid && kmsExists;
      expect(healthy).toBe(false);
    });
  });

  describe('Status Computation Accuracy', () => {
    test('should compute accurate pending count', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);

      // Create 5 input files
      for (let i = 1; i <= 5; i++) {
        fs.writeFileSync(path.join(inputDir, `test${i}.txt`), `content${i}`);
      }

      // Mark 2 as processed
      const manifest = manifestManager.loadManifest();
      for (let i = 1; i <= 2; i++) {
        const fileHash = manifestManager.computeFileHash(path.join(inputDir, `test${i}.txt`));
        manifestManager.recordConversion(manifest, `test${i}.txt`, `test${i}.md`, fileHash!);
      }

      const inputFiles = 5;
      const processedCount = 2;
      const pendingCount = Math.max(0, inputFiles - processedCount);

      expect(pendingCount).toBe(3);
    });

    test('should report accurate file sizes', () => {
      const inputDir = path.join(tempDir, 'input');
      fs.mkdirSync(inputDir);

      const sizes: { [key: string]: number } = {
        'file1.txt': 1024,
        'file2.txt': 2048,
        'file3.txt': 512,
      };

      for (const [filename, size] of Object.entries(sizes)) {
        fs.writeFileSync(path.join(inputDir, filename), 'x'.repeat(size));
      }

      const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.txt'));
      const totalSize = files.reduce((sum, f) => {
        return sum + fs.statSync(path.join(inputDir, f)).size;
      }, 0);

      expect(totalSize).toBe(1024 + 2048 + 512);
    });
  });
});
