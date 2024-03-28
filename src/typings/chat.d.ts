declare namespace Chat {

	interface Chat {
		dateTime: string
		text: string
		inversion?: boolean
		error?: boolean
		loading?: boolean
		conversationOptions?: ConversationRequest | null
		requestOptions: { prompt: string; options?: ConversationRequest | null }
		// businessType: number
	}

	interface History {
		title: string
		isEdit: boolean
		uuid: number
		businessType: string
		businessName?: string//非必填
	}

	interface ChatState {
		active: number | null
		usingContext: boolean;
		history: History[]
		// businessType: string
		chat: { uuid: number; data: Chat[]; businessType: string }[]
	}

	interface ConversationRequest {
		conversationId?: string
		parentMessageId?: string
	}

	interface ConversationResponse {
		conversationId: string
		detail: {
			choices: { finish_reason: string; index: number; logprobs: any; text: string }[]
			created: number
			id: string
			model: string
			object: string
			usage: { completion_tokens: number; prompt_tokens: number; total_tokens: number }
		}
		id: string
		parentMessageId: string
		role: string
		text: string
	}
}
