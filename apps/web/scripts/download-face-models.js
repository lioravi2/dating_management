const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../public/models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log(`Created directory: ${modelsDir}`);
}

const models = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2', // Required - model has 2 shards!
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2', // Required - model has 2 shards!
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

let downloaded = 0;
let failed = 0;

console.log('Starting download of face-api.js models...\n');

models.forEach((model) => {
  const filePath = path.join(modelsDir, model);
  const file = fs.createWriteStream(filePath);
  
  const url = baseUrl + model;
  
  https.get(url, (response) => {
    if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        downloaded++;
        console.log(`✅ Downloaded ${model} (${downloaded}/${models.length})`);
        
        if (downloaded + failed === models.length) {
          console.log(`\n✅ Download complete! ${downloaded} files downloaded.`);
          if (failed > 0) {
            console.log(`⚠️  ${failed} files failed to download.`);
          }
        }
      });
    } else {
      failed++;
      console.error(`❌ Failed to download ${model}: HTTP ${response.statusCode}`);
      fs.unlink(filePath, () => {});
      
      if (downloaded + failed === models.length) {
        console.log(`\n⚠️  Download complete with errors. ${downloaded} files downloaded, ${failed} failed.`);
      }
    }
  }).on('error', (err) => {
    failed++;
    console.error(`❌ Error downloading ${model}:`, err.message);
    fs.unlink(filePath, () => {});
    
    if (downloaded + failed === models.length) {
      console.log(`\n⚠️  Download complete with errors. ${downloaded} files downloaded, ${failed} failed.`);
    }
  });
});

console.log(`Downloading ${models.length} model files...\n`);
