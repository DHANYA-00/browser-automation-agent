const jobSearch = require("./jobSearch");
const { runJobSearch } = require("./jobSearch");

async function runJobSearchBatches(browser) {
  const jobBatches = [
    {
      keywords: "Software Engineer",
      location: "United States",
      jobType: "internship",
    },
    {
      keywords: "Data Scientist",
      location: "United States",
      jobType: "full-time",
    },
    {
      keywords: "Product Manager",
      location: "United States",
      jobType: "internship",
    },
  ];

  for (const batch of jobBatches) {
    console.log(
      `\n--- Starting batch: ${batch.keywords} (${batch.jobType}) in ${batch.location} ---`
    );
    await runJobSearch(browser, batch.keywords, batch.location, batch.jobType);
  }
}

module.exports = { runJobSearchBatches };