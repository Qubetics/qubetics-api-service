import { Response } from 'express';
import { RESPONSES, CONST_NAME } from '../constant/response';
import { IESResponse } from '../interfaces/index';

class ResponseHelper {
	// for success responses
	public success(response: Response, responseData: IESResponse = {}) {
		return response.status(RESPONSES.SUCCESS).send(responseData);
	}

	// for error responses
	public error(response: Response, responseData: IESResponse = {}) {
		let statusCode;
		if (responseData?.message) {
			if (responseData.message.indexOf(CONST_NAME.NOT_FOUND) !== -1) {
				statusCode = RESPONSES.NOTFOUND;
			} else {
				statusCode = RESPONSES.BADREQUEST;
			}
			return response.status(statusCode).send(responseData);
		}

		return response.status(RESPONSES.INTERNAL_SERVER).send(responseData);
	}
}
export default new ResponseHelper();
