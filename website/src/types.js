const ActionType = Object.freeze({
    GetUUID: 0,
    GetUsers: 1,
    SetUser: 2,
    RemoveUser: 3,
    AddUser: 4,
    GetLogs: 5,
    Reset: 6,
    StatusUser: 7,
    GetChannels : 18,
    ChangePassword: 20,
    GetAdminData: 21,
    AdminCreateUser: 22,
    AdminDeleteUser: 23,
    AdminListUsers: 24,
    GetProfile: 25,
    GetTelegramConfig: 26,
    SetTelegramConfig: 27,
    TestProxy: 28,
    AdminUpdateUserLimit: 29,
    AdminUpdateAllowedPlugins: 30,
    AdminUpdateAllowedAlerts: 31,
    AdminKillUserBots: 32,
    AdminKillAllBots: 33,
    AdminUpdateSubscription: 34,
    RenewSubscription: 35,
    AdminUpdateUserProfile: 36,
    GetNotifications: 37,
    ReadNotification: 38,
    AdminSendNotification: 39,
    AdminDeleteNotification: 40,
    AdminGetSentNotifications: 41,
    CreateCreditRequest: 42,
    ValidatePromoCode: 43,
    AdminGetCreditRequests: 44,
    AdminHandleCreditRequest: 45,
    AdminManagePromoCodes: 46,
    AdminGetSystemSettings: 47,
    AdminSaveSystemSettings: 48,
    AdminGetBannedEmails: 49,
    AdminBanEmail: 50,
    AdminUnbanEmail: 51,
    AdminGetBannedIPs: 52,
    AdminBanIP: 53,
    AdminUnbanIP: 54,
    AdminGetBlockedIPs: 55,
    AdminClearBlockedIP: 56,
    ChatbotMessage: 57,
})
const GetActionTypeName = id => 
    Object.keys(ActionType).find(key => ActionType[key] === id) ?? 
        ActionType.Unknown

const ErrorType = Object.freeze({
    Success: 0,
    UnknownAction: 1,
    Unauthenticated: 2,
    Authentication: 3,
    Generic: 4,
    UnknownError: 5,
})

const GetErrorTypeName = id => 
    Object.keys(ErrorType).find(key => ErrorType[key] === id) ??
        "UnknownError"

const LogLevel = Object.freeze({
    Info: 0,
    Warn: 1,
    Error: 2
})

class User {
    constructor(obj) {
      this.id = Number(obj.id) 
      this.state = Number(obj.state)
      this.name = String(obj.name) 
      this.pass = String(obj.pass ? obj.pass : "")
      this.plugins = obj.plugins
      this.lt = Number(obj.lt)
      this.externalEvent = Boolean(obj?.externalEvent)
      this.server = Number(obj?.server)
      this.proxyHost = obj?.proxyHost ? String(obj.proxyHost) : ""
      this.proxyPort = obj?.proxyPort ? Number(obj.proxyPort) : null
      this.proxyUser = obj?.proxyUser ? String(obj.proxyUser) : ""
      this.proxyPass = obj?.proxyPass ? String(obj.proxyPass) : ""
      this.proxyType = obj?.proxyType ? String(obj.proxyType) : ""
      this.proxyEnabled = obj?.proxyEnabled !== undefined ? Boolean(obj.proxyEnabled) : false
    }
  }
export { ActionType, GetActionTypeName, ErrorType, GetErrorTypeName, LogLevel, User }
