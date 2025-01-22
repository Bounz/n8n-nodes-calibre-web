import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IBinaryData,
	IHttpRequestOptions,
} from 'n8n-workflow';

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

					// First get CSRF token from main page
					try {
						const mainPageOptions: IHttpRequestOptions = {
							method: 'GET',
							url: '/',
							json: false,
						};

						const mainPageResponse = await this.helpers.requestWithAuthentication.call(
							this,
							'calibreWebApi',
							mainPageOptions,
						);

						// Extract CSRF token from response
						const csrfMatch = mainPageResponse.body.match(/name="csrf_token" value="([^"]+)"/);
						if (!csrfMatch) {
							throw new Error('Could not find CSRF token');
						}
						const csrfToken = csrfMatch[1];
						const cookies = mainPageResponse.headers['set-cookie'];
						const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : '';

						// Prepare the request with proper form data
						const requestOptions: IHttpRequestOptions = {
							method: 'POST',
							url: '/upload',
							body: {
								'csrf_token': csrfToken,
								'btn-upload': {
									value: await this.helpers.getBinaryDataBuffer(i, binaryPropertyName),
									options: {
										filename: binaryData.fileName || 'unknown.epub',
										contentType: binaryData.mimeType || 'application/epub+zip',
									},
								},
							},
							headers: {
								'X-Requested-With': 'XMLHttpRequest',
								Cookie: cookieHeader,
							},
						};

						// Make upload request with CSRF token and cookies
						const response = await this.helpers.requestWithAuthentication.call(
							this,
							'calibreWebApi',
							requestOptions,
						);

						returnData.push({
							json: {
								success: true,
								statusCode: response.statusCode,
								headers: response.headers,
								body: response.body,
							},
						});
					} catch (error) {
						const errorDetails = {
							statusCode: error.statusCode || error.response?.statusCode,
							message: error.message,
							response: error.response?.body || error.error,
						};

						// Log error details to n8n's execution log
						this.logger.error('Calibre Web Upload Error', { error: errorDetails });

						throw new NodeOperationError(
							this.getNode(),
							`Upload failed: ${errorDetails.response || errorDetails.message}. Status: ${
								errorDetails.statusCode || 'unknown'
							}`,
							{
								itemIndex: i,
								description: `Check if your user has upload permissions and credentials are correct. Details: ${JSON.stringify(errorDetails)}`,
							},
						);
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
