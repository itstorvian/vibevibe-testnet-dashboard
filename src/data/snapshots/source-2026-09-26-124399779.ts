import type { IncrementalOverviewExpectation } from "@/data/incremental";

/** Fixed publication pins from the reconciled indexer output; independent of runtime candidates. */
export const currentSource = {
  "source": {
    "chainId": 46630,
    "headBlock": 124399779,
    "headBlockHash": "0x4ac4a3ca08fe235d7a2427088dece9127b70b0ffd44911f1544224e6334da88e",
    "startedAt": "2026-09-25T16:46:29.885Z",
    "finishedAt": "2026-09-26T03:52:52.510Z",
    "startBlock": 95916239
  },
  "counts": {
    "launchRecords": 160851,
    "buyEvents": 2468717,
    "sellEvents": 849914,
    "lifecycleEvents": 78779,
    "foreignCurveLogs": 536,
    "uniqueTransactionCount": 3431107,
    "launchTransactionCount": 160851,
    "tradeTransactionCount": 3318631,
    "lifecycleTransactionCount": 65932,
    "sharedAcrossCategories": 114307,
    "unusableTransactionHashes": 0
  },
  "method": "incremental-cache-replay",
  "inputManifestSha256": "a0b4f8fd31dd8361c88e41e1fa4d443f8abe7c70f58ec4f61bed2c638ca21eb2",
  "incremental": {
    "prefixHeadBlock": 121309670,
    "deltaFromBlock": 121309671,
    "deltaToBlock": 124399779,
    "prefixManifestSha256": "45ac5115ff0dbfaed90f6a88f1d91a9d69da2ccf36d638049d55c8997a81e702",
    "deltaManifestSha256": "b35493454ec030d400a0143366e3fd172928b8af9fe6e656294265fafc7b0f4e",
    "proofFile": "incremental-proof.json",
    "proofSha256": "508f48dd130ab7388e4ef909275b8874d94d6bc8320fac6ab38a2fa5fd6effb7"
  },
  "participantSha256": "e682b05b4bd521d4ef9e4af0ffbf553908ba7a0e26dd33840895cdbcbed2f34e",
  "foreignCurveAddressCount": 97,
  "factories": [
    {
      "generation": "retired",
      "factory": "0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF",
      "prefixLaunchCount": 14800,
      "prefixLastObservedLaunchBlock": 121064267
    },
    {
      "generation": "legacy",
      "factory": "0xB5B7A2f6c4EAFa2D73918fcA32d50e2126339eb9",
      "prefixLaunchCount": 43220,
      "prefixLastObservedLaunchBlock": 121093373
    },
    {
      "generation": "current",
      "factory": "0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59",
      "prefixLaunchCount": 39713,
      "prefixLastObservedLaunchBlock": 121306584
    }
  ]
} as const satisfies IncrementalOverviewExpectation;
