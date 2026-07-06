using System.Collections;
using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Randomly twitches RIN's ear bones for a subtle "alive" feel.
    /// Gracefully disables if no ear bones are assigned.
    /// </summary>
    public class RINEarTwitch : MonoBehaviour
    {
        [Header("Ear Bones")]
        [Tooltip("Left ear bone Transform (optional).")]
        public Transform leftEarBone;

        [Tooltip("Right ear bone Transform (optional).")]
        public Transform rightEarBone;

        [Header("Twitch Settings")]
        [Tooltip("Minimum seconds between twitches.")]
        public float intervalMin = 3f;

        [Tooltip("Maximum seconds between twitches.")]
        public float intervalMax = 10f;

        [Tooltip("Twitch rotation angle in degrees.")]
        public float twitchAngle = 12f;

        [Tooltip("Duration of one twitch in seconds.")]
        public float twitchDuration = 0.1f;

        [Tooltip("Chance that both ears twitch together (0-1).")]
        [Range(0f, 1f)]
        public float synchronizeChance = 0.3f;

        private Quaternion _leftBaseRotation;
        private Quaternion _rightBaseRotation;
        private Coroutine _twitchRoutine;
        private bool _hasLeftEar;
        private bool _hasRightEar;

        private void Awake()
        {
            _hasLeftEar = leftEarBone != null;
            _hasRightEar = rightEarBone != null;

            if (!_hasLeftEar && !_hasRightEar)
            {
                Debug.LogWarning($"[RINEarTwitch] No ear bones assigned on '{gameObject.name}'. Disabling.");
                enabled = false;
                return;
            }

            if (_hasLeftEar) _leftBaseRotation = leftEarBone.localRotation;
            if (_hasRightEar) _rightBaseRotation = rightEarBone.localRotation;
        }

        private void OnEnable()
        {
            _twitchRoutine = StartCoroutine(TwitchLoop());
        }

        private void OnDisable()
        {
            if (_twitchRoutine != null)
            {
                StopCoroutine(_twitchRoutine);
                _twitchRoutine = null;
            }
            // Reset
            if (_hasLeftEar) leftEarBone.localRotation = _leftBaseRotation;
            if (_hasRightEar) rightEarBone.localRotation = _rightBaseRotation;
        }

        private IEnumerator TwitchLoop()
        {
            while (true)
            {
                float wait = Random.Range(intervalMin, intervalMax);
                yield return new WaitForSeconds(wait);

                bool sync = Random.value < synchronizeChance;

                if (sync)
                {
                    // Both ears twitch
                    if (_hasLeftEar) StartCoroutine(TwitchBone(leftEarBone, _leftBaseRotation, twitchAngle));
                    if (_hasRightEar) StartCoroutine(TwitchBone(rightEarBone, _rightBaseRotation, twitchAngle));
                }
                else
                {
                    // Random ear
                    if (_hasLeftEar && _hasRightEar)
                    {
                        if (Random.value < 0.5f)
                            StartCoroutine(TwitchBone(leftEarBone, _leftBaseRotation, twitchAngle));
                        else
                            StartCoroutine(TwitchBone(rightEarBone, _rightBaseRotation, twitchAngle));
                    }
                    else if (_hasLeftEar)
                    {
                        StartCoroutine(TwitchBone(leftEarBone, _leftBaseRotation, twitchAngle));
                    }
                    else
                    {
                        StartCoroutine(TwitchBone(rightEarBone, _rightBaseRotation, twitchAngle));
                    }
                }
            }
        }

        private IEnumerator TwitchBone(Transform bone, Quaternion baseRot, float angle)
        {
            float halfDuration = twitchDuration * 0.5f;
            float elapsed = 0f;

            // Rotate outward
            while (elapsed < halfDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                float easedT = Mathf.Sin(t * Mathf.PI * 0.5f); // ease-out
                bone.localRotation = baseRot * Quaternion.Euler(0f, 0f, angle * easedT);
                yield return null;
            }

            // Return to base
            elapsed = 0f;
            while (elapsed < halfDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                float easedT = 1f - Mathf.Sin((1f - t) * Mathf.PI * 0.5f); // ease-in
                bone.localRotation = baseRot * Quaternion.Euler(0f, 0f, angle * (1f - easedT));
                yield return null;
            }

            bone.localRotation = baseRot;
        }
    }
}
