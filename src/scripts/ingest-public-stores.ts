/**
 * 공공데이터포털 「소상공인시장진흥공단_상가(상권)정보」 CSV → stores 테이블 ingest.
 *
 * 사용:
 *   npm run ingest:public-stores -- /path/to/file.csv          # 단일 파일
 *   npm run ingest:public-stores -- /path/to/dir               # 디렉토리(.csv 파일 모두 sequential)
 *
 * 정책:
 *  - 우리 도메인(가격 비교)에 필요한 카테고리만 매장으로 등록한다.
 *    편의점 / 대형마트 / 슈퍼 / 동네마트 / 정육·청과·식료품·종합소매 / 전통시장
 *  - externalPlaceId 는 'public_<상가업소번호>' 로 prefix 해 unique 유지.
 *  - 같은 externalPlaceId 가 이미 있으면 INSERT 를 무시한다(orIgnore).
 *  - source = 'PUBLIC_DATA' 로 마킹해 사용자 등록 매장과 분리한다.
 *  - 한국 좌표 범위(위도 33~39, 경도 124~132) 밖이면 스킵.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { AppDataSource } from '../database/data-source';
import { Store, StoreSource } from '../store/entities/store.entity';

interface CsvRow {
  [column: string]: string | undefined;
}

const CHUNK = 1000;
const PROGRESS_EVERY = 10_000;

const pickFirst = (row: CsvRow, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim().length > 0
    ) {
      return String(value).trim();
    }
  }
  return '';
};

// 표준산업분류명 / 상권업종소분류명 → 우리 StoreType 매핑.
// 매칭이 없으면 null 을 반환해 ingest 에서 제외한다.
const mapCategoryToStoreType = (category: string): string | null => {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c.includes('편의점')) return 'convenience';
  if (c.includes('대형할인점') || c.includes('대형마트')) return 'large_mart';
  if (c.includes('슈퍼') || c.includes('수퍼')) return 'supermarket';
  if (c.includes('전통시장') || c.includes('재래시장'))
    return 'traditional_market';
  if (
    c.includes('음/식료품') ||
    c.includes('음식료품') ||
    c.includes('식료품') ||
    c.includes('종합소매')
  ) {
    return 'mart';
  }
  if (
    c.includes('정육') ||
    c.includes('청과') ||
    c.includes('야채') ||
    c.includes('과일')
  ) {
    return 'mart';
  }
  if (c.includes('수산') || c.includes('생선')) return 'mart';
  return null;
};

const isValidKoreanCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 33 &&
  lat <= 39 &&
  lng >= 124 &&
  lng <= 132;

interface IngestRow {
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string;
  externalPlaceId: string;
  source: StoreSource;
}

const flushBuffer = async (buffer: IngestRow[]): Promise<void> => {
  if (buffer.length === 0) return;
  await AppDataSource.createQueryBuilder()
    .insert()
    .into(Store)
    .values(buffer)
    .orIgnore() // ON CONFLICT DO NOTHING
    .execute();
};

interface FileStats {
  file: string;
  total: number;
  inserted: number;
  skippedCoord: number;
  skippedCategory: number;
  skippedName: number;
}

async function ingestFile(filePath: string): Promise<FileStats> {
  console.log(`[ingest] streaming CSV: ${filePath}`);
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    }),
  );

  const stats: FileStats = {
    file: path.basename(filePath),
    total: 0,
    inserted: 0,
    skippedCoord: 0,
    skippedCategory: 0,
    skippedName: 0,
  };
  let buffer: IngestRow[] = [];

  for await (const raw of parser as AsyncIterable<CsvRow>) {
    stats.total++;

    const lat = parseFloat(pickFirst(raw, '위도', 'latitude', 'lat'));
    const lng = parseFloat(pickFirst(raw, '경도', 'longitude', 'lng'));
    if (!isValidKoreanCoord(lat, lng)) {
      stats.skippedCoord++;
      continue;
    }

    const baseName = pickFirst(raw, '상호명', 'storeName', 'name');
    const branch = pickFirst(raw, '지점명', 'branchName');
    const fullName = branch ? `${baseName} ${branch}` : baseName;
    if (!fullName || fullName.length < 2 || fullName.length > 200) {
      stats.skippedName++;
      continue;
    }

    const subCategory = pickFirst(
      raw,
      '상권업종소분류명',
      '표준산업분류명',
      '상권업종중분류명',
    );
    const type = mapCategoryToStoreType(subCategory);
    if (!type) {
      stats.skippedCategory++;
      continue;
    }

    const externalRaw = pickFirst(raw, '상가업소번호', 'storeId');
    if (!externalRaw) {
      stats.skippedName++;
      continue;
    }

    const address = pickFirst(raw, '도로명주소', '지번주소', 'address');

    buffer.push({
      name: fullName.slice(0, 200),
      type,
      latitude: lat,
      longitude: lng,
      address: address.slice(0, 500),
      externalPlaceId: `public_${externalRaw}`,
      source: StoreSource.PUBLIC_DATA,
    });

    if (buffer.length >= CHUNK) {
      await flushBuffer(buffer);
      stats.inserted += buffer.length;
      buffer = [];
      if (stats.inserted % PROGRESS_EVERY === 0) {
        console.log(
          `[ingest]   ${stats.file}: total=${stats.total} inserted~=${stats.inserted} skipped(coord=${stats.skippedCoord} category=${stats.skippedCategory} name=${stats.skippedName})`,
        );
      }
    }
  }

  if (buffer.length > 0) {
    await flushBuffer(buffer);
    stats.inserted += buffer.length;
  }

  return stats;
}

async function ingest(target: string): Promise<void> {
  if (!fs.existsSync(target)) {
    throw new Error(`Path not found: ${target}`);
  }

  const targetStat = fs.statSync(target);
  let files: string[] = [];
  if (targetStat.isDirectory()) {
    files = fs
      .readdirSync(target)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((f) => path.join(target, f))
      .sort();
    if (files.length === 0) {
      throw new Error(`No .csv files in directory: ${target}`);
    }
    console.log(`[ingest] detected ${files.length} CSV files in directory`);
  } else {
    files = [target];
  }

  console.log(`[ingest] initializing data source...`);
  await AppDataSource.initialize();

  const totals = {
    total: 0,
    inserted: 0,
    skippedCoord: 0,
    skippedCategory: 0,
    skippedName: 0,
  };

  try {
    for (const file of files) {
      const stats = await ingestFile(file);
      totals.total += stats.total;
      totals.inserted += stats.inserted;
      totals.skippedCoord += stats.skippedCoord;
      totals.skippedCategory += stats.skippedCategory;
      totals.skippedName += stats.skippedName;
      console.log(
        `[ingest] ✓ ${stats.file}: total=${stats.total} inserted~=${stats.inserted} skipped(coord=${stats.skippedCoord} category=${stats.skippedCategory} name=${stats.skippedName})`,
      );
    }
  } finally {
    await AppDataSource.destroy();
  }

  console.log(
    `[ingest] === all files done === total=${totals.total} inserted~=${totals.inserted} skipped(coord=${totals.skippedCoord} category=${totals.skippedCategory} name=${totals.skippedName})`,
  );
}

const target = process.argv[2];
if (!target) {
  console.error(
    'Usage: ts-node scripts/ingest-public-stores.ts <csv-file-or-dir>',
  );
  process.exit(1);
}

ingest(target).catch((err) => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});
