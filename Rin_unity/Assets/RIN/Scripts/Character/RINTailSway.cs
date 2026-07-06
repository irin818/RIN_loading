using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Makes RIN's tail bones sway in a gentle sinusoidal wave pattern.
    /// Each bone can have a different phase offset for a natural ripple effect.
    /// Gracefully disables if no tail bones are assigned.
    /// </summary>
    public class RINTailSway : MonoBehaviour
    {
        [Header("Tail Bones")]
        [Tooltip("Ordered list of tail bones from base to tip.")]
        public Transform[] tailBones;

        [Header("Sway Parameters")]
        [Tooltip("Base sway speed in radians per second.")]
        public float swaySpeed = 2f;

        [Tooltip("Maximum sway angle in degrees per bone.")]
        public float swayAmplitude = 8f;

        [Tooltip("Phase offset between consecutive tail bones (in radians).")]
        public float phaseOffset = 0.5f;

        [Tooltip("Amplitude multiplier per bone index (1 = same, >1 = tip sways more).")]
        public float amplitudeGrowth = 1.3f;

        private Quaternion[] _baseRotations;

        private void Awake()
        {
            if (tailBones == null || tailBones.Length == 0)
            {
                Debug.LogWarning($"[RINTailSway] No tail bones assigned on '{gameObject.name}'. Disabling.");
                enabled = false;
                return;
            }

            _baseRotations = new Quaternion[tailBones.Length];
            for (int i = 0; i < tailBones.Length; i++)
            {
                if (tailBones[i] != null)
                    _baseRotations[i] = tailBones[i].localRotation;
            }

            Debug.Log($"[RINTailSway] Initialized with {tailBones.Length} tail bones.");
        }

        private void LateUpdate()
        {
            float time = Time.time;

            for (int i = 0; i < tailBones.Length; i++)
            {
                if (tailBones[i] == null) continue;

                float phase = i * phaseOffset;
                float amplitude = swayAmplitude * Mathf.Pow(amplitudeGrowth, i);
                float angle = Mathf.Sin(time * swaySpeed + phase) * amplitude;

                tailBones[i].localRotation = _baseRotations[i] * Quaternion.Euler(0f, angle, 0f);
            }
        }

        private void OnDisable()
        {
            if (_baseRotations == null) return;
            for (int i = 0; i < tailBones.Length; i++)
            {
                if (tailBones[i] != null)
                    tailBones[i].localRotation = _baseRotations[i];
            }
        }
    }
}
