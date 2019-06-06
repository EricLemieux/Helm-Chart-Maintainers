const YAML = require('yaml');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const INCLUDE_DEPRECATED = process.argv.includes('--include-deprecated') || false;

const repoFolder = 'charts';

async function pullHelmChartsRepo() {
  if (await fs.pathExists(repoFolder)) {
    await fs.remove(repoFolder);
  }
  const { stdout, stderr } = await exec(`git clone https://github.com/helm/charts.git`);
}

function ChartInfo(name, maintainers, deprecated, approvers, reviewers) {
  this.name = name,
  this.maintainers = maintainers
  this.approvers = approvers;
  this.reviewers = reviewers;
  this.deprecated = deprecated;
}

async function printChartStatus(chartName) {
  const chartFilePath = `${repoFolder}/${chartName}/Chart.yaml`;
  const chartFileContents = await fs.readFile(chartFilePath, 'utf-8');
  const chart = YAML.parse(chartFileContents);

  let numMaintainers = 0;
  if (chart.maintainers) {
    numMaintainers = chart.maintainers.length;
  }
  const isDeprecated = chart.deprecated || false;


  let approvers = 0;
  let reviewers = 0;
  const ownerFilePath = `${repoFolder}/${chartName}/OWNERS`;
  try {
    const ownerFileContents = await fs.readFile(ownerFilePath, 'utf-8');
    const owners = YAML.parse(ownerFileContents);

    if (owners.approvers) {
      approvers = owners.approvers.length;
    }
    if (owners.reviewers) {
      reviewers = owners.reviewers.length;
    }
  } catch(e) {
    // File doesn't exist, keep the default of 0.
  }

  
  return new ChartInfo(chartName, numMaintainers, isDeprecated, approvers, reviewers);
}

async function describeChartsInFolder(folder) {
  const stableChartsList = await fs.readdir(`${repoFolder}/${folder}`);
  const stableCharts = stableChartsList.map(async chart => printChartStatus(`${folder}/${chart}`));
  Promise.all(stableCharts)
    .then((completed) => {
      let sorted = completed.sort((a, b) => a.maintainers - b.maintainers);

      if (!INCLUDE_DEPRECATED) {
        sorted = sorted.filter(chart => !chart.deprecated);
      }

      console.table(sorted)
    });
}

(async () => {
  await pullHelmChartsRepo();

  await describeChartsInFolder('stable');
  await describeChartsInFolder('incubator');
})();
