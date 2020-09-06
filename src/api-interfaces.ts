export interface APIQuestion {
    _id: string
    updatedAt: string
    createdAt: string
    user: APIUser
    question: string
    isNSFW: boolean
    likesCount: number
    isDeleted: boolean
    isReported: boolean
    questionUser: APIUser | undefined
    questionAnon: boolean
    answer: string | undefined
    answeredAt: string | undefined
}

export interface APIUser {
    _id: string
    updatedAt: string
    createdAt: string
    name: string
    acct: string
    acctDisplay: string
    avatarUrl: string
    url: string
    allAnon: boolean
    questionBoxName: string | undefined
    description: string | undefined
    hostName: string
    pushbulletEnabled: boolean
    isTwitter: boolean
    stopNewQuestion: boolean,
    isAdmin: boolean,
    isDeleted: boolean
}
