using UnityEngine;
using UnityEngine.UI;

namespace RIN.UI
{
    /// <summary>
    /// Controls the main menu panel on the RIN main menu scene.
    /// Manages button states, the Start Session action, and status text display.
    /// </summary>
    public class MainMenuController : MonoBehaviour
    {
        [Header("Menu Buttons")]
        public Button startSessionButton;
        public Button continueMemoryButton;
        public Button memoryArchiveButton;
        public Button settingsButton;
        public Button shutdownButton;

        [Header("Status Display")]
        [Tooltip("Text element that shows feedback messages (e.g., 'Session Starting...').")]
        public Text statusText;

        [Tooltip("How long status messages stay visible (seconds).")]
        public float statusDisplayDuration = 3f;

        [Header("Scene References")]
        [Tooltip("Optional: name of the scene to load when Start Session is clicked.")]
        public string nextSceneName = "";

        [Header("Startup")]
        [Tooltip("Show the greeting text on scene start.")]
        public string greetingText = "RIN instance loaded.\nWelcome back.";

        private RIN.Character.RINInteractionController _rinController;
        private float _statusTimer;

        private void Awake()
        {
            // Find RIN controller
            var rin = GameObject.FindGameObjectWithTag("RIN");
            if (rin != null)
                _rinController = rin.GetComponent<RIN.Character.RINInteractionController>();

            if (_rinController == null)
                _rinController = FindFirstObjectByType<RIN.Character.RINInteractionController>();
        }

        private void Start()
        {
            // Wire up button listeners
            if (startSessionButton != null)
                startSessionButton.onClick.AddListener(OnStartSession);

            if (continueMemoryButton != null)
                continueMemoryButton.onClick.AddListener(() => ShowStatus("Memory recall in progress..."));
            if (memoryArchiveButton != null)
                memoryArchiveButton.onClick.AddListener(() => ShowStatus("Archive access granted."));
            if (settingsButton != null)
                settingsButton.onClick.AddListener(() => ShowStatus("System configuration."));
            if (shutdownButton != null)
                shutdownButton.onClick.AddListener(OnShutdown);

            // Show greeting
            ShowStatus(greetingText);

            // Play RIN greeting
            _rinController?.PlayGreeting();
        }

        private void Update()
        {
            if (_statusTimer > 0f)
            {
                _statusTimer -= Time.deltaTime;
                if (_statusTimer <= 0f && statusText != null)
                {
                    statusText.text = "";
                }
            }
        }

        private void OnStartSession()
        {
            ShowStatus("Session Starting...");

            _rinController?.OnMenuClick("StartSession");

            // Load next scene if configured
            if (!string.IsNullOrEmpty(nextSceneName))
            {
                StartCoroutine(LoadSceneDelayed(nextSceneName, 0.5f));
            }
        }

        private void OnShutdown()
        {
            ShowStatus("Shutting down...");
            _rinController?.OnMenuClick("Shutdown");

#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        private void ShowStatus(string message)
        {
            if (statusText != null)
            {
                statusText.text = message;
                _statusTimer = statusDisplayDuration;
            }
            Debug.Log($"[MainMenu] {message}");
        }

        private System.Collections.IEnumerator LoadSceneDelayed(string sceneName, float delay)
        {
            yield return new WaitForSeconds(delay);

            if (Application.CanStreamedLevelBeLoaded(sceneName))
            {
                UnityEngine.SceneManagement.SceneManager.LoadScene(sceneName);
            }
            else
            {
                Debug.LogWarning($"[MainMenu] Scene '{sceneName}' not found in build settings. Staying on main menu.");
            }
        }
    }
}
