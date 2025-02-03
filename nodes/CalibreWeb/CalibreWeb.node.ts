import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IBinaryData,
	IHttpRequestOptions
} from 'n8n-workflow';
import FormData from 'form-data';
import axios, { AxiosError } from 'axios';

interface CalibreWebError {
	statusCode?: number;
	response?: {
		statusCode?: number;
		body?: any;
	};
	message: string;
	error?: any;
}

export class CalibreWeb implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Calibre Web',
		name: 'calibreWeb',
		icon: 'file:calibreweb.svg',
		group: ['transform'],
		version: 1,
		description: 'Upload books to Calibre-Web',
		defaults: {
			name: 'Calibre Web',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'calibreWebApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl }}',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Upload Book',
						value: 'uploadBook',
						description: 'Upload a new book to Calibre-Web',
						action: 'Upload a book to calibre web',
					},
				],
				default: 'uploadBook',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: ['uploadBook'],
					},
				},
				description: 'Name of the binary property containing the file to be uploaded',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						operation: ['uploadBook'],
					},
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Title of the book',
					},
					{
						displayName: 'Author',
						name: 'author',
						type: 'string',
						default: '',
						description: 'Author of the book',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'Description/Summary of the book',
					},
					{
						displayName: 'Tags',
						name: 'tags',
						type: 'string',
						default: '',
						description: 'Comma-separated list of tags',
					},
					{
						displayName: 'Series',
						name: 'series',
						type: 'string',
						default: '',
						description: 'Series name',
					},
					{
						displayName: 'Series Index',
						name: 'series_index',
						type: 'number',
						default: 1,
						description: 'Position in series',
					},
					{
						displayName: 'Languages',
						name: 'languages',
						type: 'string',
						default: '',
						description: 'Comma-separated list of languages',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'uploadBook') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

					// Ensure binary data exists and is properly typed
					const binaryData = items[i].binary?.[binaryPropertyName] as IBinaryData | undefined;
					if (!binaryData) {
						throw new NodeOperationError(this.getNode(), 'No binary data exists on item!', {
							itemIndex: i,
						});
					}
					// Prepare form data with binary data
					const formData: IDataObject = {
						'btn-upload': {
							value: await this.helpers.getBinaryDataBuffer(i, binaryPropertyName),
							options: {
								filename: binaryData.fileName || 'unknown.epub',
								contentType: binaryData.mimeType || 'application/epub+zip',
							},
						},
					};

					// Add metadata fields if provided
					Object.keys(additionalFields).forEach((key) => {
						if (additionalFields[key] !== '') {
							formData[key] = additionalFields[key];
						}
					});

					const handleRequestError = (error: AxiosError | CalibreWebError, options: IHttpRequestOptions) => {
						const errorDetails = {
							statusCode: (error as AxiosError).response?.status || (error as CalibreWebError).statusCode,
							message: error.message,
							response: (error as AxiosError).response?.data || (error as CalibreWebError).response?.body || error.message,
						};

						this.logger.error('Calibre Web Request Error', {
							statusCode: errorDetails.statusCode,
							message: errorDetails.message,
						});

						throw new NodeOperationError(
							this.getNode(),
							`Request failed: ${errorDetails.message}. Status: ${
								errorDetails.statusCode || 'unknown'
							}`,
							{
								itemIndex: i,
								description: `Check if your user has upload permissions and credentials are correct. Details: ${JSON.stringify(errorDetails)}`,
							},
						);
					};

					// Step 1: Get CSRF token from login page
					try {
						const credentials = await this.getCredentials('calibreWebApi');
						const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

						// Step 1: Get login page and CSRF token
						const loginPageOptions: IHttpRequestOptions = {
							method: 'GET',
							url: `${baseUrl}/login`,
							returnFullResponse: true
						};

						const loginPageResponse = await this.helpers.httpRequest(loginPageOptions)
							.catch(error => handleRequestError(error, loginPageOptions));

						// Extract CSRF token from login page
						const loginCsrfMatch = loginPageResponse.body.match(/name="csrf_token" value="([^"]+)"/);
						if (!loginCsrfMatch) {
							throw new Error('Could not find CSRF token on login page');
						}
						const loginCsrfToken = loginCsrfMatch[1];
						let cookies = loginPageResponse.headers['set-cookie'];
						let cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : '';
						// STEP 2: Perform login with credentials
						let result = await axios.post(`${baseUrl}/login`, 
							`csrf_token=${encodeURIComponent(loginCsrfToken)}&username=${encodeURIComponent(credentials.username as string)}&password=${encodeURIComponent(credentials.password as string)}&rememberme=on&next=%2F`,
							{
								headers: {
									'Content-Type': 'application/x-www-form-urlencoded',
									'Cookie': cookieHeader,
									'Accept': '*/*',
								},
								maxRedirects: 0,
								validateStatus: function (s: number) {
									return s >= 200 && s <= 302
								}
							}
						);
												
						cookies = result.headers['set-cookie'];
						if (cookies) {
							cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
						}

						const mainPage = await axios.get(`${baseUrl}/`, {
							headers: {
								'Cookie': cookieHeader,
								'Accept': '*/*',
							}
						})
						// Verify successful login
						if (mainPage.data.includes('Wrong Username or Password')) {
							throw new Error('Authentication failed: Invalid credentials');
						}

						//"Wrong Username or Password"


						
						// Step 3: Get main page after login to get new CSRF token for upload
						const mainPage2 = await axios.get(`${baseUrl}/`, {
							headers: {
								'Cookie': cookieHeader,
								'Accept': '*/*',
							}
						})

						// Extract CSRF token for upload
						const uploadCsrfMatch = mainPage2.data.match(/name="csrf_token" value="([^"]+)"/);
						if (!uploadCsrfMatch) {
							throw new Error('Could not find CSRF token for upload');
						}
						const uploadCsrfToken = uploadCsrfMatch[1];

						// Create form data for file upload
						const form = new FormData();
						form.append('csrf_token', uploadCsrfToken);
						form.append('btn-upload', await this.helpers.getBinaryDataBuffer(i, binaryPropertyName), {
							filename: binaryData.fileName || 'unknown.epub',
							contentType: binaryData.mimeType || 'application/epub+zip',
						});

						let uploadResult = await axios.post(`${baseUrl}/upload`, 
							form,
							{
								headers: {
									'Content-Type': 'application/x-www-form-urlencoded',
									'Cookie': cookieHeader,
									'Accept': '*/*',
								}
							}
						);
						this.logger.debug('DATA: ' + JSON.stringify(uploadResult.data));						
						const uploadedLocation = uploadResult.data?.location

						returnData.push({
							json: {
								success: Boolean(uploadedLocation),
								location: uploadedLocation
							},
						});
					} catch (error) {
						// Handle any other unexpected errors
						this.logger.error('Unexpected Calibre Web Error', { error });
						this.logger.warn('Trace: ' + error.stack);
						throw new NodeOperationError(this.getNode(), 'An unexpected error occurred', {
							itemIndex: i,
							description: error.message,
						});
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
