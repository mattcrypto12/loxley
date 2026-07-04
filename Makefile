.PHONY: anvil demo web test build

anvil:
	anvil --chain-id 31337 --timestamp $$(( $$(date +%s) - 14*86400 ))

demo:
	./scripts/demo.sh

web:
	cd web && pnpm dev

test:
	cd contracts && forge test

build:
	cd contracts && forge build
	cd web && pnpm build
