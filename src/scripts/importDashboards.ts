import fs from 'fs';
import path from 'path';
import { promql, Expression } from 'tsqtsq';
import { allMetricNames } from '../utils/metricsFetcher.js';
const inputDir = 'data/raw'; // Directory containing JSON files
const outputDir = 'data/processed'; // Directory to save processed files

console.log(allMetricNames);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Interface for vector database entries
interface VectorEntry {
  name: string;
  description: string;
  queries: string[];
}

// Function to modify a PromQL query
function modifyPromQLQuery(query: string): string {
  // Set the time interval to 30m
  query = query.replace(/\[\$\__rate_interval\]/g, '[30m]');

  // Remove braces
  query = query.replace(/\{[^}]*\}/g, '');

  return query;
}

// Function to transform a single file
function transformFile(inputPath: string, outputPath: string): void {
  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const grafanaData = JSON.parse(rawData);

  const vectorData: VectorEntry[] = grafanaData.panels.map((panel: any) => {
    const name = panel.title || '';
    const description = panel.description || ''; 
    const queries = (panel.targets || [])
      .map((target: any) => {
        if (typeof target.expr === 'string') {
          return modifyPromQLQuery(target.expr);
        }
        return '';
      });
    
    return {
      name,
      description,
      queries,
    };
  }).filter((entry: VectorEntry) => {
    if (entry === null) return false; // Exclude invalid panels
    if (entry.queries.every(query => query.trim() === "")) {
      console.warn(`Panel "${entry.name}" has no valid queries and will be excluded.`);
      return false; // Exclude panels with no valid queries
    }
    return true;
  });

  // Only write the file if vectorData is valid and not empty
  if (vectorData && Array.isArray(vectorData) && vectorData.length > 0) {
    fs.writeFileSync(outputPath, JSON.stringify(vectorData, null, 2), 'utf-8');
    console.log(`File written successfully to ${outputPath}`);
  } else {
    console.warn(`No valid vector data to write. Skipping file creation.`);
  }

}

// Process all JSON files in the input directory
fs.readdir(inputDir, (err, files) => {
  if (err) {
    console.error('Error reading input directory:', err);
    return;
  }

  files.forEach((file) => {
    const inputFilePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);

    // Process only .json files
    if (path.extname(file).toLowerCase() === '.json') {
      try {
        transformFile(inputFilePath, outputFilePath);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
  });
});