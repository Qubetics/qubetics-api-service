import axios from 'axios';
import Web3Helper from '../../helper/web3.helper';
import { RES_MSG, CONST_NAME } from '../../constant/response';
import Redis from '../../service/redis.helper';
import logger from '../../lib/logger';
import {
	isExponentialNumber,
	getDigitsAfterE,
} from '../../lib/utilities.helper';

class FaucetService {
	async captchaRequest(token: string) {
		console.log(
			'GET TOKEN VLAUE',
			`${environment.recaptchaUrl}--------${environment.recaptchaSiteKey}------${token}`,
		);
		return new Promise(async (resolve, reject) => {
			try {
				const res = await axios.post(
					`${environment.recaptchaUrl}?secret=${environment.recaptchaSiteKey}&response=${token}`,
				);

				if (res.data.success) {
					resolve(true);
				} else {
					reject(RES_MSG.INVALID_USER_ERROR);
				}
			} catch (err) {
				console.log('Errrrr', err);
				reject(RES_MSG.CAPTCHA_ERROR);
			}
		});
	}

	async fundTransfer(to: string, _captchaToken: string) {
		try {
			// console.log(
			// 	'Capcha: ',
			// 	to,
			// 	_captchaToken,
			// 	'Environment: ',
			// 	environment.recaptchaUrl,
			// );

			let faucetBalance;
			const privateKey = `0x${environment.privateKey}`;
			const existingData = await Redis.client.get(`${to}`);
			if (!existingData) {
				Web3Helper.isValidAddress(to);

				await this.captchaRequest(_captchaToken);
				let account = await Web3Helper.getAccount(privateKey);

				if (account?.address !== environment.publicKey) {
					throw new Error(RES_MSG.INVALID_PRIVATE_KEY);
				}

				const faucetAccountBalance = await Web3Helper.getBalance(
					environment.publicKey,
				);

				faucetBalance =
					Number(faucetAccountBalance.toString()) / Math.pow(10, 18);

				if (isExponentialNumber(faucetBalance.toString())) {
					const expValue = getDigitsAfterE(faucetBalance.toString());
					faucetBalance = faucetBalance.toFixed(expValue);
				}
				const value = environment.faucetAmount;

				if (Number(faucetBalance) <= Number(value))
					throw new Error(RES_MSG.FAUCET_ACCOUNT_BALANCE_LOW);

				const rawTransaction = {
					to: to,
					gas: CONST_NAME.GAS,
					from: environment.publicKey,
					maxFeePerGas: CONST_NAME.MAX_FEES,
					maxPriorityFeePerGas: CONST_NAME.MAX_PRIORIY_FEES,
					value: (Number(value) * Math.pow(10, 18)).toString(),
					nonce: Number(
						(
							await Web3Helper.getTransactionCount(
								environment.publicKey,
							)
						).toString(),
					),
				};

				const signedTx = await Web3Helper.signTransaction(
					rawTransaction,
					privateKey,
				);

				const data = await Web3Helper.sendSignedTransaction(
					signedTx.rawTransaction,
				);

				await Redis.client.setEx(
					`${to}`,
					CONST_NAME.EXPIRE_TIME,
					`${value}`,
				);

				return {
					error: false,
					data: { txHash: data.transactionHash },
					message: RES_MSG.TRANSACTION_DONE,
				};
			} else {
				throw new Error(RES_MSG.FAUCET_MSG);
			}
		} catch (err) {
			console.log('Error while fund transfer ', err);
			const errorMessage =
				err instanceof Error ? err.message : RES_MSG.ERROR;
			return { error: true, message: errorMessage };
		}
	}
}

export default new FaucetService();
