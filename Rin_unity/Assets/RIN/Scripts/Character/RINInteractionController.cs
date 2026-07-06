using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Central controller for RIN's reactions to menu interactions.
    /// Receives events from UI and triggers Animator parameters and expressions.
    /// Supports multiple menu items with distinct reactions.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class RINInteractionController : MonoBehaviour
    {
        [Header("Dependencies")]
        [Tooltip("Animator component (required).")]
        public Animator animator;

        [Tooltip("Expression controller for facial reactions (optional).")]
        public RINExpressionController expressionController;

        [Header("Reaction Settings")]
        [Tooltip("Cooldown in seconds between click reactions to avoid spamming.")]
        public float clickCooldown = 0.8f;

        [Tooltip("How many consecutive clicks trigger a special reaction.")]
        public int rapidClickThreshold = 3;

        [Tooltip("Time window for counting rapid clicks (seconds).")]
        public float rapidClickWindow = 2f;

        // Animator parameter hashes (cached for performance)
        private static readonly int ParamGreeting = Animator.StringToHash("Greeting");
        private static readonly int ParamHoverReact = Animator.StringToHash("HoverReact");
        private static readonly int ParamClickReact = Animator.StringToHash("ClickReact");
        private static readonly int ParamLongIdleReact = Animator.StringToHash("LongIdleReact");
        private static readonly int ParamExpressionIndex = Animator.StringToHash("ExpressionIndex");

        private float _lastClickTime = -10f;
        private int _rapidClickCount;
        private float _firstRapidClickTime = -10f;

        private void Awake()
        {
            if (animator == null)
                animator = GetComponent<Animator>();

            if (expressionController == null)
                expressionController = GetComponent<RINExpressionController>();

            if (animator == null)
                Debug.LogError($"[RINInteractionController] No Animator found on '{gameObject.name}'!");
        }

        /// <summary>Called when the cursor hovers over a menu item.</summary>
        public void OnMenuHover(string menuId)
        {
            if (animator == null) return;

            animator.SetTrigger(ParamHoverReact);
            animator.SetInteger(ParamExpressionIndex, GetExpressionForMenu(menuId));

            // Subtle expression change
            if (expressionController != null)
            {
                switch (menuId)
                {
                    case "StartSession":
                        expressionController.SetExpression("Curious");
                        break;
                    case "MemoryArchive":
                        expressionController.SetExpression("Serious");
                        break;
                    default:
                        expressionController.SetSmile(20f);
                        break;
                }
            }
        }

        /// <summary>Called when the cursor leaves a menu item.</summary>
        public void OnMenuExit(string menuId)
        {
            if (expressionController != null)
                expressionController.ResetExpression();
        }

        /// <summary>Called when a menu item is clicked.</summary>
        public void OnMenuClick(string menuId)
        {
            if (animator == null) return;

            float timeSinceLastClick = Time.time - _lastClickTime;

            // Cooldown check
            if (timeSinceLastClick < clickCooldown) return;

            _lastClickTime = Time.time;

            // Rapid click tracking
            if (Time.time - _firstRapidClickTime < rapidClickWindow)
            {
                _rapidClickCount++;
            }
            else
            {
                _rapidClickCount = 1;
                _firstRapidClickTime = Time.time;
            }

            // Trigger reactions
            bool isRapid = _rapidClickCount >= rapidClickThreshold;

            if (isRapid)
            {
                // Special rapid-click reaction
                _rapidClickCount = 0;
                if (expressionController != null)
                    expressionController.SetExpression("Glitch");
                Debug.Log($"[RINInteractionController] Rapid click detected on '{menuId}' — special reaction triggered.");
            }
            else
            {
                animator.SetTrigger(ParamClickReact);
            }

            // Menu-specific reactions
            switch (menuId)
            {
                case "StartSession":
                    if (expressionController != null) expressionController.SetExpression("Smile");
                    break;
                case "ContinueMemory":
                    if (expressionController != null) expressionController.SetExpression("Curious");
                    break;
                case "Shutdown":
                    if (expressionController != null) expressionController.SetExpression("Serious");
                    break;
            }
        }

        /// <summary>Called when the player is idle for too long.</summary>
        public void OnLongIdle()
        {
            if (animator == null) return;

            animator.SetTrigger(ParamLongIdleReact);
            if (expressionController != null)
                expressionController.SetExpression("Curious");

            Debug.Log("[RINInteractionController] Long idle reaction triggered.");
        }

        /// <summary>Play the greeting animation (used on scene start).</summary>
        public void PlayGreeting()
        {
            if (animator == null) return;
            animator.SetTrigger(ParamGreeting);
        }

        /// <summary>Trigger the click react animation directly (for non-menu clicks on RIN).</summary>
        public void OnRinClicked()
        {
            OnMenuClick("RIN_Direct");
        }

        private static int GetExpressionForMenu(string menuId)
        {
            return menuId switch
            {
                "StartSession" => 1,   // Curious/Smile
                "ContinueMemory" => 2, // Thoughtful
                "MemoryArchive" => 3,  // Serious
                "Settings" => 4,       // Neutral
                "Shutdown" => 5,       // Serious
                _ => 0                 // Neutral
            };
        }
    }
}
