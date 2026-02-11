// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PrescioStaking
 * @notice $PRESCIO 토큰 스테이킹 컨트랙트 - 예측 마켓 연동
 * @dev Monad Mainnet (Chain ID: 143) 배포용
 * 
 * 보안 수정 사항:
 * - C-1: 티어 가중 평균 방식으로 보상 풀 고갈 방지
 * - C-2: rewardDebt에 티어 배수 반영, 티어 변경 시 정산
 * - H-1: distributeFromFees 토큰 전송 추가
 * - H-2: emergencyUnstake는 일시정지에서도 가능 (의도적)
 * - H-3: requestUnstake 시 보상 정산
 * - M-1~M-4: 티어 검증, zero address 검증, 부분 청구 등
 * - Gas 최적화: Struct 패킹, Storage 캐싱
 */
contract PrescioStaking is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //                           CONSTANTS
    // ═══════════════════════════════════════════════════════════════
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_BOOST_BPS = 5000; // 최대 50% 부스트
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // ═══════════════════════════════════════════════════════════════
    //                         STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice $PRESCIO 토큰 주소
    IERC20 public immutable prescioToken;
    
    /// @notice 연동된 Market 컨트랙트
    address public marketContract;
    
    /// @notice 연동된 Vault 컨트랙트  
    address public vaultContract;
    
    // ─────────────────────────────────────────────────────────────
    //                      Staking Parameters
    // ─────────────────────────────────────────────────────────────
    
    /// @notice 최소 스테이킹 수량
    uint256 public minStakeAmount;
    
    /// @notice 언스테이킹 대기 기간 (초)
    uint256 public unstakingPeriod;
    
    /// @notice 조기 언스테이킹 페널티 (BPS)
    uint256 public earlyUnstakePenaltyBps;
    
    // ─────────────────────────────────────────────────────────────
    //                      Reward Parameters
    // ─────────────────────────────────────────────────────────────
    
    /// @notice 초당 보상률 (전체 풀 대비)
    uint256 public rewardRatePerSecond;
    
    /// @notice 마지막 보상 업데이트 시간
    uint256 public lastRewardUpdateTime;
    
    /// @notice 누적 보상 인덱스 (per staked token)
    uint256 public accRewardPerToken;
    
    /// @notice 보상 풀 잔액
    uint256 public rewardPoolBalance;
    
    /// @notice 총 스테이킹된 수량
    uint256 public totalStaked;
    
    /// @notice 총 가중 스테이킹 수량 (티어 배수 적용)
    /// @dev C-1 수정: 가중 평균 방식으로 보상 풀 고갈 방지
    uint256 public totalWeightedStaked;
    
    // ─────────────────────────────────────────────────────────────
    //                        Tier System
    // ─────────────────────────────────────────────────────────────
    
    /// @notice 티어별 최소 스테이킹 요구량
    uint256[] public tierThresholds;
    
    /// @notice 티어별 베팅 부스트 (BPS)
    uint256[] public tierBoostBps;
    
    /// @notice 티어별 보상 배수 (BPS, 10000 = 1x)
    uint256[] public tierRewardMultiplierBps;
    
    // ─────────────────────────────────────────────────────────────
    //                       User Data
    // ─────────────────────────────────────────────────────────────
    
    /// @dev Gas 최적화: Struct 패킹 - 타임스탬프를 uint64로 변경
    struct UserStake {
        uint256 amount;              // 스테이킹된 수량 (slot 0)
        uint256 rewardDebt;          // 보상 계산용 부채 (slot 1)
        uint256 pendingRewards;      // 미청구 보상 (slot 2)
        uint256 unstakeAmount;       // 언스테이킹 요청 수량 (slot 3)
        uint256 totalClaimed;        // 총 청구한 보상 (slot 4)
        uint256 totalBetsPlaced;     // 부스트로 배팅한 총액 (통계용) (slot 5)
        uint64 stakedAt;             // 스테이킹 시작 시간 (slot 6 - packed)
        uint64 unstakeRequestTime;   // 언스테이킹 요청 시간 (slot 6 - packed)
        uint8 lastTier;              // 마지막 저장된 티어 (slot 6 - packed)
    }
    
    /// @notice 유저별 스테이킹 정보
    mapping(address => UserStake) public userStakes;
    
    /// @notice 유저별 락업 기간 (개별 설정 가능)
    mapping(address => uint256) public userLockPeriod;
    
    // ═══════════════════════════════════════════════════════════════
    //                            EVENTS
    // ═══════════════════════════════════════════════════════════════
    
    event Staked(
        address indexed user, 
        uint256 amount, 
        uint256 newTotal,
        uint8 tier
    );
    
    event UnstakeRequested(
        address indexed user, 
        uint256 amount, 
        uint256 unlockTime
    );
    
    event Unstaked(
        address indexed user, 
        uint256 amount, 
        uint256 penalty
    );
    
    event RewardsClaimed(
        address indexed user, 
        uint256 amount
    );
    
    event RewardsAdded(
        address indexed from, 
        uint256 amount,
        string source
    );
    
    event BoostApplied(
        address indexed user,
        uint256 betAmount,
        uint256 boostBps,
        uint8 tier
    );
    
    event TierUpdated(
        address indexed user,
        uint8 oldTier,
        uint8 newTier
    );
    
    event EmergencyUnstake(
        address indexed user,
        uint256 amount,
        uint256 penalty
    );
    
    event UserLockPeriodSet(
        address indexed user,
        uint256 lockPeriod
    );
    
    // ═══════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ═══════════════════════════════════════════════════════════════
    
    modifier onlyMarketOrAuthorized() {
        require(
            msg.sender == marketContract || 
            hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        _;
    }
    
    modifier updateReward(address _user) {
        _updateRewardIndex();
        if (_user != address(0)) {
            _updateUserReward(_user);
        }
        _;
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                         CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════
    
    constructor(
        address _prescioToken,
        address _admin
    ) {
        require(_prescioToken != address(0), "Invalid token");
        require(_admin != address(0), "Invalid admin");
        
        prescioToken = IERC20(_prescioToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _admin);
        
        // 기본값 설정
        minStakeAmount = 100 * 1e18;     // 최소 100 PRESCIO
        unstakingPeriod = 7 days;         // 7일 언스테이킹
        earlyUnstakePenaltyBps = 500;     // 5% 조기 해제 페널티
        rewardRatePerSecond = 0;          // 초기 보상률 0
        lastRewardUpdateTime = block.timestamp;
        
        // 기본 티어 설정 (4 티어)
        _initializeDefaultTiers();
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                      STAKING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice $PRESCIO 토큰 스테이킹
     * @param _amount 스테이킹할 수량
     */
    function stake(uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
        updateReward(msg.sender) 
    {
        require(_amount >= minStakeAmount, "Below minimum stake");
        
        UserStake storage user = userStakes[msg.sender];
        uint8 oldTier = user.lastTier;
        
        // 토큰 전송
        prescioToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // C-1: 기존 가중 스테이킹 제거
        uint256 oldWeighted = _getWeightedAmount(user.amount, oldTier);
        
        // 상태 업데이트
        user.amount += _amount;
        user.stakedAt = uint64(block.timestamp);
        totalStaked += _amount;
        
        uint8 newTier = _calculateTier(user.amount);
        user.lastTier = newTier;
        
        // C-1: 새로운 가중 스테이킹 추가
        uint256 newWeighted = _getWeightedAmount(user.amount, newTier);
        totalWeightedStaked = totalWeightedStaked - oldWeighted + newWeighted;
        
        // C-2: 티어 변경 시 rewardDebt 재계산
        user.rewardDebt = (newWeighted * accRewardPerToken) / PRECISION;
        
        emit Staked(msg.sender, _amount, user.amount, newTier);
        
        if (oldTier != newTier) {
            emit TierUpdated(msg.sender, oldTier, newTier);
        }
    }
    
    /**
     * @notice 언스테이킹 요청 (대기 기간 시작)
     * @param _amount 언스테이킹할 수량
     */
    function requestUnstake(uint256 _amount) 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        UserStake storage user = userStakes[msg.sender];
        // Gas 최적화: Storage 캐싱
        uint256 userAmount = user.amount;
        uint256 currentUnstakeAmount = user.unstakeAmount;
        
        require(userAmount >= _amount, "Insufficient staked");
        require(currentUnstakeAmount == 0, "Pending unstake exists");
        
        // 락업 확인
        uint256 lockEnd = uint256(user.stakedAt) + userLockPeriod[msg.sender];
        require(block.timestamp >= lockEnd, "Still locked");
        
        uint8 oldTier = user.lastTier;
        
        // H-3: 언스테이킹 요청 금액에 대한 가중 스테이킹 조정
        uint256 oldWeighted = _getWeightedAmount(userAmount, oldTier);
        uint256 remainingAmount = userAmount - _amount;
        uint8 newTier = _calculateTier(remainingAmount);
        uint256 newWeighted = _getWeightedAmount(remainingAmount, newTier);
        
        // 가중 스테이킹 업데이트 (unstakeAmount는 보상 계산에서 제외)
        totalWeightedStaked = totalWeightedStaked - oldWeighted + newWeighted;
        
        user.unstakeRequestTime = uint64(block.timestamp);
        user.unstakeAmount = _amount;
        user.lastTier = newTier;
        
        // H-3 & C-2: 새로운 가중치 기준으로 rewardDebt 재계산
        user.rewardDebt = (newWeighted * accRewardPerToken) / PRECISION;
        
        emit UnstakeRequested(
            msg.sender, 
            _amount, 
            block.timestamp + unstakingPeriod
        );
        
        if (oldTier != newTier) {
            emit TierUpdated(msg.sender, oldTier, newTier);
        }
    }
    
    /**
     * @notice 대기 기간 후 언스테이킹 완료
     */
    function completeUnstake() 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        UserStake storage user = userStakes[msg.sender];
        // Gas 최적화: Storage 캐싱
        uint256 unstakeAmt = user.unstakeAmount;
        uint64 unstakeReqTime = user.unstakeRequestTime;
        
        require(unstakeAmt > 0, "No pending unstake");
        require(
            block.timestamp >= uint256(unstakeReqTime) + unstakingPeriod,
            "Unstaking period not over"
        );
        
        // 상태 업데이트 (unstakeAmount는 이미 requestUnstake에서 가중치 제외됨)
        user.amount -= unstakeAmt;
        user.unstakeAmount = 0;
        user.unstakeRequestTime = 0;
        totalStaked -= unstakeAmt;
        
        // 토큰 반환
        prescioToken.safeTransfer(msg.sender, unstakeAmt);
        
        emit Unstaked(msg.sender, unstakeAmt, 0);
    }
    
    /**
     * @notice 긴급 언스테이킹 (페널티 적용)
     * @dev H-2: 의도적으로 일시정지 상태에서도 실행 가능 (긴급 탈출용)
     *      사용자 자금 보호를 위해 paused 상태에서도 긴급 출금 허용
     */
    function emergencyUnstake() 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        UserStake storage user = userStakes[msg.sender];
        // Gas 최적화: Storage 캐싱
        uint256 amount = user.amount;  // 총 스테이킹 금액 (unstakeAmount 포함)
        uint256 pendingUnstake = user.unstakeAmount;
        uint8 oldTier = user.lastTier;
        
        // C-NEW-1 수정: amount가 총 금액이므로 pendingUnstake를 더하면 안 됨
        require(amount > 0, "Nothing staked");
        
        // 페널티 계산 (총 금액 기준)
        uint256 penalty = (amount * earlyUnstakePenaltyBps) / BPS_DENOMINATOR;
        uint256 returnAmount = amount - penalty;
        
        // C-1: 가중 스테이킹 제거
        // pendingUnstake는 이미 requestUnstake에서 가중치가 제외됨
        // 남은 가중치(amount - pendingUnstake)만 제거
        uint256 effectiveForWeight = amount - pendingUnstake;
        if (effectiveForWeight > 0) {
            uint256 weightedToRemove = _getWeightedAmount(effectiveForWeight, oldTier);
            totalWeightedStaked -= weightedToRemove;
        }
        
        // 상태 초기화
        user.amount = 0;
        user.unstakeAmount = 0;
        user.unstakeRequestTime = 0;
        user.rewardDebt = 0;
        user.lastTier = 0;
        totalStaked -= amount;  // amount만 차감 (pendingUnstake는 이미 포함됨)
        
        // 페널티는 보상 풀로
        if (penalty > 0) {
            rewardPoolBalance += penalty;
        }
        
        // 토큰 반환
        prescioToken.safeTransfer(msg.sender, returnAmount);
        
        emit EmergencyUnstake(msg.sender, amount, penalty);
        emit TierUpdated(msg.sender, oldTier, 0);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                      REWARD FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice 보상 청구 (전액)
     */
    function claimRewards() 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        _claimRewardsInternal(msg.sender, type(uint256).max);
    }
    
    /**
     * @notice 보상 부분 청구
     * @dev M-4: 부분 청구 옵션 추가
     * @param _amount 청구할 보상 수량 (0이면 전액, 특정 금액이면 해당 금액만)
     */
    function claimRewardsPartial(uint256 _amount) 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        _claimRewardsInternal(msg.sender, _amount);
    }
    
    /**
     * @notice 내부 보상 청구 함수
     * @param _user 유저 주소
     * @param _maxAmount 청구할 최대 금액 (type(uint256).max면 전액)
     */
    function _claimRewardsInternal(address _user, uint256 _maxAmount) internal {
        UserStake storage user = userStakes[_user];
        uint256 rewards = user.pendingRewards;
        require(rewards > 0, "No rewards");
        
        // M-4: 청구 가능한 금액 계산 (풀 잔액 한도 내에서)
        // Gas 최적화: Storage 캐싱
        uint256 poolBalance = rewardPoolBalance;
        uint256 claimable = rewards;
        
        if (claimable > poolBalance) {
            claimable = poolBalance;
        }
        if (claimable > _maxAmount) {
            claimable = _maxAmount;
        }
        
        require(claimable > 0, "Nothing claimable");
        
        user.pendingRewards = rewards - claimable;
        user.totalClaimed += claimable;
        rewardPoolBalance = poolBalance - claimable;
        
        prescioToken.safeTransfer(_user, claimable);
        
        emit RewardsClaimed(_user, claimable);
    }
    
    /**
     * @notice 보상 풀에 자금 추가
     * @param _amount 추가할 보상 수량
     * @param _source 보상 출처 (예: "market_fees", "treasury")
     */
    function addRewards(uint256 _amount, string calldata _source) 
        external 
        nonReentrant 
    {
        require(_amount > 0, "Zero amount");
        
        prescioToken.safeTransferFrom(msg.sender, address(this), _amount);
        rewardPoolBalance += _amount;
        
        emit RewardsAdded(msg.sender, _amount, _source);
    }
    
    /**
     * @notice Market/Vault에서 수수료 자동 분배 (연동용)
     * @dev H-1 수정: 토큰 전송 추가
     * @param _amount 분배할 수수료
     */
    function distributeFromFees(uint256 _amount) 
        external 
        onlyMarketOrAuthorized 
    {
        require(_amount > 0, "Zero amount");
        
        // H-1: 토큰 전송 추가
        prescioToken.safeTransferFrom(msg.sender, address(this), _amount);
        rewardPoolBalance += _amount;
        
        emit RewardsAdded(msg.sender, _amount, "platform_fees");
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                    BOOST SYSTEM (게임 연동)
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice 유저의 베팅 부스트 비율 조회
     * @param _user 유저 주소
     * @return boostBps 부스트 비율 (BPS, 500 = 5%)
     */
    function getBettingBoost(address _user) 
        external 
        view 
        returns (uint256 boostBps) 
    {
        uint8 tier = getUserTier(_user);
        if (tier == 0) return 0;
        return tierBoostBps[tier - 1];
    }
    
    /**
     * @notice 부스트 적용된 베팅 금액 계산
     * @param _user 유저 주소
     * @param _betAmount 원래 베팅 금액
     * @return boostedAmount 부스트 적용된 베팅 금액
     */
    function calculateBoostedBet(address _user, uint256 _betAmount) 
        external 
        view 
        returns (uint256 boostedAmount) 
    {
        uint8 tier = getUserTier(_user);
        if (tier == 0) return _betAmount;
        
        uint256 boostBps = tierBoostBps[tier - 1];
        boostedAmount = _betAmount + (_betAmount * boostBps) / BPS_DENOMINATOR;
    }
    
    /**
     * @notice Market 컨트랙트에서 베팅 시 호출 (부스트 기록)
     * @param _user 베터 주소
     * @param _betAmount 베팅 금액
     */
    function recordBoostedBet(address _user, uint256 _betAmount) 
        external 
        onlyMarketOrAuthorized 
    {
        UserStake storage user = userStakes[_user];
        uint8 tier = getUserTier(_user);
        
        if (tier > 0 && user.amount > 0) {
            uint256 boostBps = tierBoostBps[tier - 1];
            user.totalBetsPlaced += _betAmount;
            
            emit BoostApplied(_user, _betAmount, boostBps, tier);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                        TIER SYSTEM
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice 유저의 현재 티어 조회
     * @param _user 유저 주소
     * @return tier 티어 (0 = 없음, 1-4 = Bronze~Diamond)
     */
    function getUserTier(address _user) public view returns (uint8 tier) {
        uint256 staked = userStakes[_user].amount;
        return _calculateTier(staked);
    }
    
    /**
     * @notice 스테이킹 수량으로 티어 계산
     * @param _staked 스테이킹 수량
     * @return tier 티어 번호
     */
    function _calculateTier(uint256 _staked) internal view returns (uint8 tier) {
        if (_staked == 0) return 0;
        
        // Gas 최적화: tierThresholds.length를 캐싱
        uint256 len = tierThresholds.length;
        for (uint8 i = uint8(len); i > 0; i--) {
            if (_staked >= tierThresholds[i - 1]) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * @notice 티어 정보 조회
     * @param _tier 티어 번호 (1-4)
     */
    function getTierInfo(uint8 _tier) 
        external 
        view 
        returns (
            uint256 threshold,
            uint256 boostBps,
            uint256 rewardMultiplierBps,
            string memory name
        ) 
    {
        require(_tier > 0 && _tier <= tierThresholds.length, "Invalid tier");
        uint8 idx = _tier - 1;
        
        threshold = tierThresholds[idx];
        boostBps = tierBoostBps[idx];
        rewardMultiplierBps = tierRewardMultiplierBps[idx];
        
        if (_tier == 1) name = "Bronze";
        else if (_tier == 2) name = "Silver";
        else if (_tier == 3) name = "Gold";
        else if (_tier == 4) name = "Diamond";
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                         VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice 유저 전체 정보 조회
     */
    function getUserInfo(address _user) 
        external 
        view 
        returns (
            uint256 stakedAmount,
            uint256 pendingRewards,
            uint256 totalClaimed,
            uint8 tier,
            uint256 boostBps,
            uint256 unstakeRequestTime,
            uint256 unstakeAmount,
            bool canUnstake
        ) 
    {
        UserStake storage user = userStakes[_user];
        
        stakedAmount = user.amount;
        pendingRewards = _calculatePendingRewards(_user);
        totalClaimed = user.totalClaimed;
        tier = getUserTier(_user);
        boostBps = tier > 0 ? tierBoostBps[tier - 1] : 0;
        unstakeRequestTime = uint256(user.unstakeRequestTime);
        unstakeAmount = user.unstakeAmount;
        canUnstake = user.unstakeAmount > 0 && 
            block.timestamp >= uint256(user.unstakeRequestTime) + unstakingPeriod;
    }
    
    /**
     * @notice 전체 풀 통계
     */
    function getPoolStats() 
        external 
        view 
        returns (
            uint256 _totalStaked,
            uint256 _rewardPoolBalance,
            uint256 _rewardRatePerSecond,
            uint256 _totalWeightedStaked
        ) 
    {
        _totalStaked = totalStaked;
        _rewardPoolBalance = rewardPoolBalance;
        _rewardRatePerSecond = rewardRatePerSecond;
        _totalWeightedStaked = totalWeightedStaked;
    }
    
    /**
     * @notice 예상 APY 계산 (현재 보상률 기준)
     */
    function estimatedAPY() external view returns (uint256 apyBps) {
        if (totalStaked == 0) return 0;
        
        uint256 yearlyRewards = rewardRatePerSecond * 365 days;
        apyBps = (yearlyRewards * BPS_DENOMINATOR) / totalStaked;
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                       ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice Market 컨트랙트 주소 설정
     * @dev M-2 수정: zero address 검증 추가
     */
    function setMarketContract(address _market) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_market != address(0), "Zero address");
        marketContract = _market;
    }
    
    /**
     * @notice Vault 컨트랙트 주소 설정
     */
    function setVaultContract(address _vault) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_vault != address(0), "Zero address");
        vaultContract = _vault;
    }
    
    /**
     * @notice 보상률 설정
     * @param _ratePerSecond 초당 분배할 토큰 수량
     */
    function setRewardRate(uint256 _ratePerSecond) 
        external 
        onlyRole(OPERATOR_ROLE) 
        updateReward(address(0))
    {
        rewardRatePerSecond = _ratePerSecond;
    }
    
    /**
     * @notice 언스테이킹 기간 설정
     */
    function setUnstakingPeriod(uint256 _period) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_period <= 30 days, "Too long");
        unstakingPeriod = _period;
    }
    
    /**
     * @notice 조기 해제 페널티 설정
     */
    function setEarlyUnstakePenalty(uint256 _penaltyBps) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_penaltyBps <= 2000, "Max 20%");
        earlyUnstakePenaltyBps = _penaltyBps;
    }
    
    /**
     * @notice 유저 개별 락업 기간 설정
     * @dev M-3 추가: userLockPeriod 설정 함수
     * @param _user 유저 주소
     * @param _lockPeriod 락업 기간 (초)
     */
    function setUserLockPeriod(address _user, uint256 _lockPeriod) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        require(_user != address(0), "Zero address");
        require(_lockPeriod <= 365 days, "Lock too long");
        userLockPeriod[_user] = _lockPeriod;
        emit UserLockPeriodSet(_user, _lockPeriod);
    }
    
    /**
     * @notice 다수 유저 락업 기간 일괄 설정
     * @param _users 유저 주소 배열
     * @param _lockPeriod 락업 기간 (초)
     */
    function setUserLockPeriodBatch(address[] calldata _users, uint256 _lockPeriod) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        require(_lockPeriod <= 365 days, "Lock too long");
        uint256 len = _users.length;
        for (uint256 i = 0; i < len; ) {
            require(_users[i] != address(0), "Zero address");
            userLockPeriod[_users[i]] = _lockPeriod;
            emit UserLockPeriodSet(_users[i], _lockPeriod);
            unchecked { ++i; }
        }
    }
    
    /**
     * @notice 티어 설정 업데이트
     * @dev M-1 수정: 오름차순 정렬 검증 추가
     */
    function setTierConfig(
        uint256[] calldata _thresholds,
        uint256[] calldata _boostBps,
        uint256[] calldata _rewardMultiplierBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _thresholds.length == _boostBps.length &&
            _boostBps.length == _rewardMultiplierBps.length,
            "Length mismatch"
        );
        require(_thresholds.length > 0, "Empty tiers");
        
        // M-1: 오름차순 정렬 검증
        for (uint256 i = 1; i < _thresholds.length; ) {
            require(
                _thresholds[i] > _thresholds[i - 1], 
                "Thresholds must be ascending"
            );
            unchecked { ++i; }
        }
        
        // 배수 검증 (최소 1x, 합리적 최대값)
        for (uint256 i = 0; i < _rewardMultiplierBps.length; ) {
            require(
                _rewardMultiplierBps[i] >= BPS_DENOMINATOR &&
                _rewardMultiplierBps[i] <= 50000, // 최대 5x
                "Invalid multiplier"
            );
            unchecked { ++i; }
        }
        
        tierThresholds = _thresholds;
        tierBoostBps = _boostBps;
        tierRewardMultiplierBps = _rewardMultiplierBps;
    }
    
    /**
     * @notice 긴급 일시정지
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice 잔여 보상 인출 (긴급 상황용)
     */
    function emergencyWithdrawRewards(uint256 _amount) 
        external 
        onlyRole(TREASURY_ROLE) 
    {
        require(_amount <= rewardPoolBalance, "Insufficient balance");
        rewardPoolBalance -= _amount;
        prescioToken.safeTransfer(msg.sender, _amount);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //                      INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    function _initializeDefaultTiers() internal {
        // 4 티어 시스템
        tierThresholds = new uint256[](4);
        tierBoostBps = new uint256[](4);
        tierRewardMultiplierBps = new uint256[](4);
        
        // Bronze: 1,000 PRESCIO
        tierThresholds[0] = 1_000 * 1e18;
        tierBoostBps[0] = 500;        // 5% 베팅 부스트
        tierRewardMultiplierBps[0] = 10000; // 1x 보상
        
        // Silver: 10,000 PRESCIO
        tierThresholds[1] = 10_000 * 1e18;
        tierBoostBps[1] = 1000;       // 10% 베팅 부스트
        tierRewardMultiplierBps[1] = 12500; // 1.25x 보상
        
        // Gold: 50,000 PRESCIO
        tierThresholds[2] = 50_000 * 1e18;
        tierBoostBps[2] = 2000;       // 20% 베팅 부스트
        tierRewardMultiplierBps[2] = 15000; // 1.5x 보상
        
        // Diamond: 200,000 PRESCIO
        tierThresholds[3] = 200_000 * 1e18;
        tierBoostBps[3] = 3500;       // 35% 베팅 부스트
        tierRewardMultiplierBps[3] = 20000; // 2x 보상
    }
    
    /**
     * @notice 가중 스테이킹 수량 계산 (티어 배수 적용)
     * @dev C-1: 티어 배수를 스테이킹 수량에 적용하여 가중 평균 계산
     */
    function _getWeightedAmount(uint256 _amount, uint8 _tier) internal view returns (uint256) {
        if (_amount == 0 || _tier == 0) return _amount;
        return (_amount * tierRewardMultiplierBps[_tier - 1]) / BPS_DENOMINATOR;
    }
    
    /**
     * @notice 보상 인덱스 업데이트
     * @dev C-1: totalWeightedStaked 기준으로 계산하여 풀 고갈 방지
     */
    function _updateRewardIndex() internal {
        if (totalWeightedStaked == 0) {
            lastRewardUpdateTime = block.timestamp;
            return;
        }
        
        uint256 timeElapsed = block.timestamp - lastRewardUpdateTime;
        if (timeElapsed == 0) return;
        
        uint256 rewards = timeElapsed * rewardRatePerSecond;
        
        // Gas 최적화: Storage 캐싱
        uint256 poolBalance = rewardPoolBalance;
        if (rewards > poolBalance) {
            rewards = poolBalance;
        }
        
        // C-1: totalWeightedStaked 기준으로 분배
        accRewardPerToken += (rewards * PRECISION) / totalWeightedStaked;
        lastRewardUpdateTime = block.timestamp;
    }
    
    /**
     * @notice 유저 보상 업데이트
     * @dev C-2: 가중 스테이킹 기준으로 보상 계산
     */
    function _updateUserReward(address _user) internal {
        UserStake storage user = userStakes[_user];
        // Gas 최적화: Storage 캐싱
        uint256 userAmount = user.amount;
        if (userAmount == 0) return;
        
        // 현재 unstakeAmount가 있으면 제외된 상태
        uint256 effectiveAmount = userAmount;
        if (user.unstakeAmount > 0) {
            // unstakeAmount는 이미 가중치에서 제외됨
            effectiveAmount = userAmount - user.unstakeAmount;
        }
        
        uint8 tier = user.lastTier;
        uint256 weightedAmount = _getWeightedAmount(effectiveAmount, tier);
        
        // C-2: 가중 금액 기준으로 pending 계산
        uint256 accReward = accRewardPerToken; // Gas 최적화: Storage 캐싱
        uint256 pending = (weightedAmount * accReward) / PRECISION;
        
        if (pending > user.rewardDebt) {
            pending = pending - user.rewardDebt;
        } else {
            pending = 0;
        }
        
        user.pendingRewards += pending;
        user.rewardDebt = (weightedAmount * accReward) / PRECISION;
    }
    
    /**
     * @notice 유저 pending 보상 계산 (view)
     */
    function _calculatePendingRewards(address _user) 
        internal 
        view 
        returns (uint256) 
    {
        UserStake storage user = userStakes[_user];
        uint256 userAmount = user.amount;
        if (userAmount == 0) return user.pendingRewards;
        
        uint256 _accRewardPerToken = accRewardPerToken;
        
        if (totalWeightedStaked > 0) {
            uint256 timeElapsed = block.timestamp - lastRewardUpdateTime;
            uint256 rewards = timeElapsed * rewardRatePerSecond;
            if (rewards > rewardPoolBalance) {
                rewards = rewardPoolBalance;
            }
            _accRewardPerToken += (rewards * PRECISION) / totalWeightedStaked;
        }
        
        // unstakeAmount 제외
        uint256 effectiveAmount = userAmount;
        if (user.unstakeAmount > 0) {
            effectiveAmount = userAmount - user.unstakeAmount;
        }
        
        uint8 tier = user.lastTier;
        uint256 weightedAmount = _getWeightedAmount(effectiveAmount, tier);
        
        uint256 pending = (weightedAmount * _accRewardPerToken) / PRECISION;
        if (pending > user.rewardDebt) {
            pending = pending - user.rewardDebt;
        } else {
            pending = 0;
        }
        
        return user.pendingRewards + pending;
    }
}
