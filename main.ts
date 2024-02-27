import { processFile } from "./utils/parseCSV";
import { calculateDistribution } from "./calculateDistribution";
import { populateAllocateTransaction } from "./populateAllocateTransaction";
import { generateStrategyTransactions } from "./generateStrategyTransactions";
import * as dotenv from "dotenv";
import { simulateTransaction } from "./simulateTransaction";
import { writeToCSV } from "./utils/writeCSV";

dotenv.config();

const filePath = "example_votes.csv";

async function main() {
  // Parse votes from CSV
  const parsedVotes = await processFile(filePath);

  // Calculate distribution across chains
  const { votes, targetChain } = calculateDistribution(parsedVotes, "default");

  console.log(`Found ${votes.length} votes for ${targetChain} chains.`);
  // Create voting transactions
  const allocateTransactions = await Promise.all(
    votes.map((vote) => populateAllocateTransaction("QVSimple", vote)),
  ).then((txs) => txs.filter((tx) => tx !== null));

  console.log(`Generated ${allocateTransactions.length} transactions.`);

  const quotes = await Promise.all(
    allocateTransactions
      .map((allocateTx) =>
        generateStrategyTransactions("lifi", allocateTx.tx, allocateTx.vote),
      )
      .filter((tx) => tx !== null),
  );

  console.log(`Received ${quotes.length} quotes.`);

  const simulations = await Promise.all(
    quotes.map(({ quote }) => simulateTransaction(quote.transactionRequest)),
  );

  // write to CSV
  const columns = [
    "txHash",
    "fromChain",
    "fromTokenAddress",
    "fromTokenAmount",
    "toChain",
    "toTokenAddress",
    "toTokenAmount",
    "gasPrice",
    "totalCostUSD",
  ];

  // txHash = simulation.hash
  // fromChain = quotes.request.fromChain
  // fromTokenAddress = quotes.request.fromTokenAddress
  // fromTokenAmount = quotes.request.fromAmount
  // toChain = quotes.request.toChain
  // toTokenAddress = quotes.request.toToken
  // toTokenAmount = quotes.request.toAmount
  // gasPrice = simulation.gasPrice
  // value = simulation.value
  // totalCostUSD = quotes.costs.feeCosts + quotes.costs.gasCosts

  const data = simulations.map((simulation, index) => {
    const quote = quotes[index].request;

    console.log(quotes[index].costs);
    const totalCost =
      Number(quotes[index].costs.feeCosts) +
      Number(quotes[index].costs.gasCosts);

    return [
      simulation.hash,
      quote.fromChain,
      quote.contractCalls[0].fromTokenAddress,
      quote.contractCalls[0].fromAmount,
      quote.toChain,
      quote.toToken,
      quote.toAmount,
      simulation.gasPrice,
      simulation.value.toString(),
      totalCost,
    ];
  });

  console.log(`Simulated ${simulations.length} transactions.`);

  // Write to CSV
  writeToCSV({ fileName: "output.csv", data, columns });
}

main();
