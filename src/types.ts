export type TabType = 'home' | 'fortune' | 'purchase' | 'team' | 'me' | 'admin' | 'transactions' | 'notifications';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id?: string;
  userId?: string;
  username?: string;
  whatsappNo?: string;
  name?: string;
  mobile: string;
  email?: string;
  membershipNumber: string;
  referralCode?: string;
  referredBy?: string;
  role?: UserRole;
  status?: 'active' | 'suspended' | 'banned';
  deviceEarnings: number;
  teamEarnings: number;
  walletBalance: number;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterFormData {
  username: string;
  whatsappNo: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
}

export interface LoginFormData {
  identifier: string;
  password: string;
}

export interface Wallet {
  id: string;
  userId: string;
  availableBalance: number;
  rechargeBalance?: number;
  earnedBalance?: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType =
  | 'RECHARGE'
  | 'PLAN_PURCHASE'
  | 'PRO_PLAN_PURCHASE'
  | 'HOURLY_EARNING'
  | 'PRO_EARNING'
  | 'EARNING_CLAIM'
  | 'PRO_INSTANT_BONUS'
  | 'REFERRAL_BONUS'
  | 'TEAM_BONUS'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_REVERSAL'
  | 'REFUND'
  | 'ADMIN_ADJUSTMENT'
  | 'EARNING';

export type TransactionStatus =
  | 'Pending'
  | 'Completed'
  | 'Rejected'
  | 'Failed'
  | 'Processing'
  | 'Cancelled';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  balanceType?: 'RECHARGE_BALANCE' | 'DEVICE_EARNING_BALANCE' | string;
  status?: TransactionStatus | string;
  referenceId?: string;
  description?: string;
  paymentMethod?: string;
  utr?: string;
  orderId?: string;
  planName?: string;
  userMobile?: string;
  username?: string;
  bankDetails?: string;
  createdAt: string;
}

export interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  ctaText: string;
  badge?: string;
  bgGradient?: string;
  artworkType?: 'commission' | 'bonus' | 'powerbank';
}

export type PlanCategory = 'HOURLY' | 'PRO' | string;
export type EarningType = 'HOURLY' | 'DAILY' | 'FIXED' | 'CUSTOM';
export type EligibilityType = 'ANY_ACTIVE_HOURLY' | 'SPECIFIC_HOURLY' | 'MINIMUM_INVESTMENT' | 'NONE';

export interface ProductItem {
  id: string;
  name: string;
  category?: PlanCategory;
  description?: string;
  imageUrl?: string;
  limit: number;
  devicePrice: number;
  price?: number; // alias
  hourlyEarnings: number;
  dailyEarnings?: number;
  instantBonus?: number;
  earningType?: EarningType;
  duration?: number; // duration in days or hours
  durationDays?: number;
  tags: string[];
  imageType: 'cabinet-green' | 'cabinet-silver' | 'cabinet-medium' | 'cabinet-small' | 'cabinet-mini' | 'cabinet-pro' | string;
  status?: 'active' | 'disabled' | 'sold_out' | 'archived';
  allowDuplicate?: boolean;
  requiresActiveHourlyPlan?: boolean;
  
  // PRO plan eligibility requirements
  eligibilityType?: EligibilityType;
  minimumHourlyPlans?: number;
  minimumHourlyInvestment?: number;
  allowedHourlyPlanIds?: string[];
  sortOrder?: number;
}

export interface PurchaseItem {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  planCategory?: PlanCategory;
  amount: number;
  instantBonus?: number;
  dailyEarnings?: number;
  hourlyEarnings?: number;
  earningRate: number;
  earningType?: EarningType;
  durationDays?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  expiresAt?: string;
  totalEarned: number;
  lastSettledAt?: string;
  lastCalculatedAt?: string;
}

export type EarningStatus = 'CLAIMABLE' | 'CLAIMED' | 'CANCELLED';

export interface EarningRecord {
  id: string;
  userId: string;
  purchaseId: string;
  planName?: string;
  planCategory?: PlanCategory;
  amount: number;
  earningType: 'HOURLY_DEVICE' | 'PRO_DAILY' | 'REFERRAL_BONUS' | string;
  status: EarningStatus;
  earningDate: string;
  claimBatchId?: string;
  claimedAt?: string;
  earnedAt?: string;
  createdAt: string;
}

export interface ClaimBatch {
  id: string;
  userId: string;
  amount: number;
  itemsCount: number;
  status: 'CLAIMED';
  claimedAt: string;
  txId?: string;
}

export interface ProEligibilityConfig {
  proEnabled?: boolean;
  requireActiveHourlyPlan?: boolean;
  minimumActiveHourlyPlans?: number;
  minActiveHourlyPlans?: number;
  allowAnyHourlyPlan?: boolean;
  proBonusAutoCredit?: boolean;
  minimumHourlyInvestment?: number;
  allowDuplicateProPurchase?: boolean;
  claimEnabled?: boolean;
  minClaimAmount?: number;
}

export type PaymentStatus = 'PAYMENT_PENDING' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED' | 'FAILED';

export interface PaymentItem {
  id: string;
  userId: string;
  username?: string;
  userMobile?: string;
  orderId: string;
  amount: number;
  paymentType: string;
  utr?: string;
  utrNumber?: string;
  proofUrl?: string;
  screenshotUrl?: string;
  status: PaymentStatus;
  adminId?: string;
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
  updatedAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  content?: string; // alias for description
  imageUrl?: string;
  image_url?: string;
  category?: string;
  tag?: string; // alias for category
  isPublished?: boolean;
  is_published?: boolean;
  sortOrder?: number;
  sort_order?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  date: string;
}

export interface FortuneRecord {
  id: string;
  date: string;
  type: 'device' | 'promotion' | 'settlement' | 'bonus';
  description: string;
  amount: number;
  status: 'completed' | 'processing';
}

export interface TeamStats {
  referralCode: string;
  referralLink: string;
  totalMembers: number;
  directMembers: number;
  activeDevices: number;
  totalCommission: number;
  level1Commission: number;
  level2Commission: number;
  level3Commission: number;
}

export interface BankAccount {
  id: string;
  userId: string;
  accountHolderName: string;
  holderName?: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  ifscCode?: string;
  upiId?: string;
  isDefault: boolean;
  createdAt?: string;
}

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface WithdrawalItem {
  id: string;
  userId: string;
  username?: string;
  userMobile?: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankAccountId?: string;
  bankDetails?: BankAccount;
  upiId?: string;
  status: WithdrawalStatus;
  adminNote?: string;
  rejectionReason?: string;
  referenceId?: string;
  createdAt: string;
  processedAt?: string;
}

export type NotificationType =
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'PROMOTION'
  | 'PLAN'
  | 'RECHARGE'
  | 'WITHDRAWAL'
  | 'EARNING'
  | 'MAINTENANCE'
  | 'OTHER';

export type TargetAudienceType =
  | 'ALL_USERS'
  | 'ACTIVE_USERS'
  | 'SPECIFIC_USER'
  | 'MULTIPLE_USERS'
  | 'HOURLY_PLAN_USERS'
  | 'PRO_PLAN_USERS';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: NotificationType;
  isRead: boolean;
  isHomePopup: boolean;
  homePopupDismissed: boolean;
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actionText?: string | null;
  status?: 'active' | 'archived';
  batchId?: string;
  targetAudience?: string;
}

export interface AdminCreateNotificationPayload {
  title: string;
  description: string;
  type: NotificationType;
  targetAudience: TargetAudienceType;
  specificUserIds?: string[];
  isHomePopup: boolean;
  expiresAt?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
}

export interface AdminNotificationHistoryItem {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  targetAudience: string;
  targetCount: number;
  readCount: number;
  isHomePopup: boolean;
  expiresAt?: string;
  createdAt: string;
  status: 'active' | 'archived';
  actionUrl?: string;
  actionText?: string;
  imageUrl?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
}

export interface PaymentSettings {
  id: string;
  upiId: string;
  qrImageUrl?: string;
  instructions: string;
  isRechargeEnabled: boolean;
  isPurchaseEnabled: boolean;
  updatedAt?: string;
}

export interface AdminSession {
  token: string;
  adminId: string;
  username: string;
  role: 'admin';
  expiresAt: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalWalletBalance: number;
  totalRecharge: number;
  pendingRecharge: number;
  pendingRechargesCount?: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  pendingWithdrawalsCount?: number;
  totalInvestments: number;
  activeHourlyPlans: number;
  activeProPlans: number;
  totalEarnings: number;
  totalClaimableEarnings: number;
  totalClaimedEarnings: number;
  referralEarnings: number;
}

export interface AdminUserDetails {
  profile: UserProfile;
  wallet: Wallet | null;
  purchases: PurchaseItem[];
  recharges: PaymentItem[];
  withdrawals: WithdrawalItem[];
  transactions: WalletTransaction[];
  earnings: EarningRecord[];
  claims: ClaimBatch[];
  referrals: {
    id: string;
    refereeUsername?: string;
    refereeMobile?: string;
    bonusAmount: number;
    createdAt: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  adminUserId: string;
  adminUsername?: string;
  action: string;
  targetType: string;
  targetId?: string;
  description: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface SystemSettings {
  minWithdrawal: number;
  maxWithdrawal: number;
  withdrawalFeePercent: number;
  referralBonusPercent: number;
  isRechargeEnabled: boolean;
  isWithdrawalEnabled: boolean;
  isClaimEnabled: boolean;
  isProEnabled: boolean;
  isHourlyPlanEnabled: boolean;
  upiId: string;
  qrImageUrl?: string;
  instructions: string;
  isUniVePayDepositEnabled?: boolean;
  isUpiDepositEnabled?: boolean;
  isManualWithdrawalEnabled?: boolean;
  isUniVePayAutoWithdrawalEnabled?: boolean;
  gatewayFeePercent?: number;
}

export type DepositStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export interface DepositTransaction {
  id: string;
  userId: string;
  username?: string;
  userMobile?: string;
  traceno: string;
  gatewayOrderId?: string;
  gatewaySerialNo?: string;
  amount: number;
  currency: string;
  payCode: string;
  status: DepositStatus;
  gatewayStatus?: string;
  payUrl?: string;
  callbackReceived?: boolean;
  signatureVerified?: boolean;
  utr?: string;
  callbackPayload?: any;
  gatewayResponse?: any;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalTransaction {
  id: string;
  userId: string;
  username?: string;
  userMobile?: string;
  traceno: string;
  gatewaySerialNo?: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: 'MANUAL' | 'UNIVEPAY_AUTO';
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REJECTED' | 'REFUNDED';
  gatewayStatus?: string;
  bankName?: string;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;
  upiId?: string;
  paymentType?: string;
  utr?: string;
  gatewayResponse?: any;
  callbackPayload?: any;
  amountLocked: number;
  rejectionReason?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  walletType: 'RECHARGE' | 'DEVICE_EARNING';
  transactionType: TransactionType | string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  referenceType?: string;
  referenceId?: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface GatewayLog {
  id: string;
  endpoint: string;
  direction: 'INBOUND' | 'OUTBOUND';
  traceno?: string;
  userTransactionId?: string;
  httpStatus?: number;
  gatewayStatus?: string;
  responseCode?: string;
  payload?: any;
  errorMessage?: string;
  createdAt: string;
}

export interface GatewaySettings {
  id: string;
  isUniVePayDepositEnabled: boolean;
  isUpiDepositEnabled: boolean;
  isManualWithdrawalEnabled: boolean;
  isUniVePayAutoWithdrawalEnabled: boolean;
  minWithdrawal: number;
  maxWithdrawal: number;
  withdrawalFeePercent: number;
  gatewayFeePercent: number;
  merchantNo?: string;
  gatewayTotalBalance?: number;
  gatewayAvailableBalance?: number;
  gatewayLastChecked?: string;
  gatewayConnectivity?: 'CONNECTED' | 'DISCONNECTED' | 'CHECKING';
  updatedAt?: string;
}

export interface UniVePayBalanceResult {
  merchantNo: string;
  balance: number;
  balanceCanUse: number;
  retcode: string;
  retmsg: string;
  serialNo?: string;
  lastChecked: string;
}

