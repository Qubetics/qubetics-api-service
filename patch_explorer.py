import re

with open("src/module/explorer/explorer.service.ts", "r") as f:
    content = f.read()

old_tokens = """				tokens =
					await prisma.$queryRaw` SELECT t."tokenName", t."tokenSymbol", t."contractAddress" AS "contractAddress", c."address" AS "contract_address",COUNT(tr."id") AS "transactionCount" FROM "Tokens" t JOIN "Contracts" c ON LOWER(t."contractAddress") = LOWER(c."address") LEFT JOIN "Transactions" tr ON LOWER(t."contractAddress") = LOWER(tr."toAddress") OR LOWER(t."contractAddress") = LOWER(tr."fromAddress") WHERE t."type" = 'ERC-20' AND (LOWER(t."contractAddress") ILIKE ${
						'%' + searchedWord + '%'
					} OR t."tokenName" ILIKE ${
						'%' + searchedWord + '%'
					} OR t."tokenSymbol" ILIKE ${
						'%' + searchedWord + '%'
					}) GROUP BY t."contractAddress", t."tokenName",t."tokenSymbol", c."address" ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

new_tokens = """				tokens =
					await prisma.$queryRaw` SELECT t."tokenName", t."tokenSymbol", t."contractAddress" AS "contractAddress", c."address" AS "contract_address",
					(SELECT COUNT(*)::int FROM (
						SELECT txhash FROM "Transactions" WHERE "toAddress" = c."address"
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "fromAddress" = c."address"
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "toAddress" = LOWER(c."address")
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "fromAddress" = LOWER(c."address")
					) AS tr) AS "transactionCount"
					FROM "Tokens" t JOIN "Contracts" c ON LOWER(t."contractAddress") = LOWER(c."address") WHERE t."type" = 'ERC-20' AND (LOWER(t."contractAddress") ILIKE ${
						'%' + searchedWord + '%'
					} OR t."tokenName" ILIKE ${
						'%' + searchedWord + '%'
					} OR t."tokenSymbol" ILIKE ${
						'%' + searchedWord + '%'
					}) ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

old_contracts = """				contracts =
					await prisma.$queryRaw` SELECT c."address" AS "address", COUNT(tr."id") AS "transactionCount", cv."contractname" as contract_name, (cv."contractAddress") AS "contractAddress" FROM "ContractVerification" cv RIGHT JOIN "Contracts" c ON LOWER(cv."contractAddress") = LOWER(c."address") LEFT JOIN "Transactions" tr ON LOWER(c."address") = LOWER(tr."toAddress") OR LOWER(c."address") = LOWER(tr."fromAddress") WHERE LOWER(c."address") ILIKE ${
						'%' + searchedWord + '%'
					} OR cv."contractname" ILIKE ${
						'%' + searchedWord + '%'
					} GROUP BY (c."address"), cv."contractname", (cv."contractAddress") ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

new_contracts = """				contracts =
					await prisma.$queryRaw` SELECT c."address" AS "address", cv."contractname" as contract_name, (cv."contractAddress") AS "contractAddress",
					(SELECT COUNT(*)::int FROM (
						SELECT txhash FROM "Transactions" WHERE "toAddress" = c."address"
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "fromAddress" = c."address"
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "toAddress" = LOWER(c."address")
						UNION ALL
						SELECT txhash FROM "Transactions" WHERE "fromAddress" = LOWER(c."address")
					) AS tr) AS "transactionCount"
					FROM "ContractVerification" cv RIGHT JOIN "Contracts" c ON LOWER(cv."contractAddress") = LOWER(c."address") WHERE LOWER(c."address") ILIKE ${
						'%' + searchedWord + '%'
					} OR cv."contractname" ILIKE ${
						'%' + searchedWord + '%'
					} ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

old_addresses = """				addresses =
					await prisma.$queryRaw` SELECT (u."address") AS "address", COUNT(tr."id") AS "transactionCount" FROM "Users" u LEFT JOIN "Transactions" tr ON (u."address") = (tr."toAddress") OR (u."address") = (tr."fromAddress") WHERE (u."address") ILIKE ${
						'%' + checkSumAddress + '%'
					} GROUP BY (u."address") ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

new_addresses = """				addresses =
					await prisma.$queryRaw` SELECT (u."address") AS "address", (u."txn")::int AS "transactionCount" FROM "Users" u WHERE (u."address") ILIKE ${
						'%' + checkSumAddress + '%'
					} ORDER BY "transactionCount" DESC LIMIT ${
						payload.limit
					} OFFSET ${offset}`;"""

content = content.replace(old_tokens, new_tokens)
content = content.replace(old_contracts, new_contracts)
content = content.replace(old_addresses, new_addresses)

with open("src/module/explorer/explorer.service.ts", "w") as f:
    f.write(content)

