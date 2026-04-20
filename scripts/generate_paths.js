const fs = require('fs');
const fg = require('fast-glob');
const path = require('path');

const ROOT = path.join(__dirname, './../public');

const bgImages = [].concat(
  fg.globSync(ROOT+"/bg/**/*.jpg", {dot: true}).map((p) => p.split(ROOT)[1]),
  fg.globSync(ROOT+"/bg/**/*.png", {dot: true}).map((p) => p.split(ROOT)[1]),
  fg.globSync(ROOT+"/bg/**/*.mp4", {dot: true}).map((p) => p.split(ROOT)[1])
).filter((p) => !p.includes('thumb-'));
const vrmList = fg.globSync(ROOT+"/vrm/**/*.vrm", {dot: true}).map((p) => p.split(ROOT)[1]);
const speechT5SpeakerEmbeddingsList = fg.globSync(ROOT+"/speecht5_speaker_embeddings/**/*.bin", {dot: true}).map((p) => p.split(ROOT)[1]);
const animationList = [].concat(
  fg.globSync(ROOT+"/animations/**/*.vrma", {dot: true}).map((p) => p.split(ROOT)[1]),
  fg.globSync(ROOT+"/animations/**/*.fbx", {dot: true}).map((p) => p.split(ROOT)[1])
);

let str = "";
str += `export const bgImages = ${JSON.stringify(bgImages)};\n`;
str += `export const vrmList = ${JSON.stringify(vrmList)};\n`;
str += `export const speechT5SpeakerEmbeddingsList = ${JSON.stringify(speechT5SpeakerEmbeddingsList)};\n`;
str += `export const animationList = ${JSON.stringify(animationList)};\n`;

fs.writeFileSync(path.join(__dirname, './../src/paths.ts'), str);
