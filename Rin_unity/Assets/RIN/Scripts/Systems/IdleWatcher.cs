using UnityEngine;

namespace RIN.Systems
{
    /// <summary>
    /// Watches for player inactivity and triggers idle reactions on RIN.
    /// After 30s of no input: RIN long-idle reaction.
    /// After 90s of no input: subtle environment glitch effect.
    /// </summary>
    public class IdleWatcher : MonoBehaviour
    {
        [Header("Timing")]
        [Tooltip("Seconds before triggering RIN long idle reaction.")]
        public float longIdleThreshold = 30f;

        [Tooltip("Seconds before triggering environment glitch.")]
        public float glitchThreshold = 90f;

        [Header("Glitch Effect (Subtle)")]
        [Tooltip("Lights to flicker on glitch.")]
        public Light[] glitchLights;

        [Tooltip("Duration of the light flicker in seconds.")]
        public float glitchFlickerDuration = 0.3f;

        [Tooltip("Probability (0-1) that a glitch lamp actually flickers.")]
        [Range(0f, 1f)]
        public float glitchChance = 0.4f;

        private RIN.Character.RINInteractionController _rinController;
        private float _lastInputTime;
        private bool _longIdleTriggered;
        private bool _glitchTriggered;

        private void Awake()
        {
            var rin = GameObject.FindGameObjectWithTag("RIN");
            if (rin != null)
                _rinController = rin.GetComponent<RIN.Character.RINInteractionController>();

            if (_rinController == null)
                _rinController = FindFirstObjectByType<RIN.Character.RINInteractionController>();

            _lastInputTime = Time.time;
        }

        private void Update()
        {
            // Detect any input
            if (Input.anyKey || Input.mousePosition != _lastMousePosition || Input.GetAxis("Mouse ScrollWheel") != 0f)
            {
                _lastInputTime = Time.time;
                _longIdleTriggered = false;
                _glitchTriggered = false;
            }

            _lastMousePosition = Input.mousePosition;

            float idleTime = Time.time - _lastInputTime;

            // Long idle reaction
            if (!_longIdleTriggered && idleTime >= longIdleThreshold)
            {
                _longIdleTriggered = true;
                _rinController?.OnLongIdle();
            }

            // Glitch effect
            if (!_glitchTriggered && idleTime >= glitchThreshold)
            {
                _glitchTriggered = true;
                TriggerGlitch();
            }
        }

        private Vector3 _lastMousePosition;

        private void TriggerGlitch()
        {
            if (glitchLights == null || glitchLights.Length == 0) return;

            foreach (var light in glitchLights)
            {
                if (light == null) continue;
                if (Random.value > glitchChance) continue;

                StartCoroutine(FlickerLight(light));
            }

            Debug.Log("[IdleWatcher] Environment glitch triggered.");
        }

        private System.Collections.IEnumerator FlickerLight(Light targetLight)
        {
            float originalIntensity = targetLight.intensity;
            float elapsed = 0f;

            while (elapsed < glitchFlickerDuration)
            {
                elapsed += Time.deltaTime;
                targetLight.intensity = originalIntensity * Random.Range(0.2f, 1.5f);
                yield return null;
            }

            targetLight.intensity = originalIntensity;
        }

        /// <summary>Manually reset the idle timer (call after programmatic actions).</summary>
        public void ResetIdleTimer()
        {
            _lastInputTime = Time.time;
            _longIdleTriggered = false;
            _glitchTriggered = false;
        }
    }
}
