using System.Collections;
using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Controls RIN's blinking via BlendShapes on a SkinnedMeshRenderer.
    /// If no BlendShape is found, gracefully disables itself with a warning.
    /// Blinks occur at random intervals with configurable speed.
    /// </summary>
    public class RINBlinkController : MonoBehaviour
    {
        [Header("BlendShape Settings")]
        [Tooltip("The SkinnedMeshRenderer that has blink BlendShapes (usually the face/head mesh).")]
        public SkinnedMeshRenderer skinnedMeshRenderer;

        [Tooltip("Name of the left eye blink BlendShape.")]
        public string leftBlinkBlendShapeName = "blink_left";

        [Tooltip("Name of the right eye blink BlendShape.")]
        public string rightBlinkBlendShapeName = "blink_right";

        [Header("Timing")]
        [Tooltip("Minimum seconds between blinks.")]
        public float intervalMin = 2f;

        [Tooltip("Maximum seconds between blinks.")]
        public float intervalMax = 6f;

        [Tooltip("Duration of one blink (open → closed → open) in seconds.")]
        public float blinkDuration = 0.15f;

        [Header("Behavior")]
        [Tooltip("Target BlendShape weight when fully closed (0-100).")]
        [Range(0f, 100f)]
        public float blinkClosedWeight = 100f;

        private int _leftBlinkIndex = -1;
        private int _rightBlinkIndex = -1;
        private Coroutine _blinkRoutine;
        private bool _hasBlendShapes;

        private void Awake()
        {
            if (skinnedMeshRenderer == null)
            {
                // Try to find on self or children
                skinnedMeshRenderer = GetComponentInChildren<SkinnedMeshRenderer>();
            }

            if (skinnedMeshRenderer == null)
            {
                Debug.LogWarning($"[RINBlinkController] No SkinnedMeshRenderer found on '{gameObject.name}'. Disabling.");
                enabled = false;
                return;
            }

            var mesh = skinnedMeshRenderer.sharedMesh;
            if (mesh == null || mesh.blendShapeCount == 0)
            {
                Debug.LogWarning($"[RINBlinkController] No BlendShapes found on mesh '{skinnedMeshRenderer.name}'. Disabling blink (character will not blink).");
                enabled = false;
                return;
            }

            _leftBlinkIndex = mesh.GetBlendShapeIndex(leftBlinkBlendShapeName);
            _rightBlinkIndex = mesh.GetBlendShapeIndex(rightBlinkBlendShapeName);

            if (_leftBlinkIndex < 0 && _rightBlinkIndex < 0)
            {
                Debug.LogWarning($"[RINBlinkController] BlendShapes '{leftBlinkBlendShapeName}' or '{rightBlinkBlendShapeName}' not found. Disabling blink.");
                enabled = false;
                return;
            }

            _hasBlendShapes = true;
        }

        private void OnEnable()
        {
            if (_hasBlendShapes)
                _blinkRoutine = StartCoroutine(BlinkLoop());
        }

        private void OnDisable()
        {
            if (_blinkRoutine != null)
            {
                StopCoroutine(_blinkRoutine);
                _blinkRoutine = null;
            }
        }

        private IEnumerator BlinkLoop()
        {
            while (true)
            {
                float wait = Random.Range(intervalMin, intervalMax);
                yield return new WaitForSeconds(wait);

                yield return StartCoroutine(PerformBlink());
            }
        }

        private IEnumerator PerformBlink()
        {
            float halfDuration = blinkDuration * 0.5f;

            // Close eyes
            float elapsed = 0f;
            while (elapsed < halfDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                SetBlinkWeight(t * blinkClosedWeight);
                yield return null;
            }

            SetBlinkWeight(blinkClosedWeight);

            // Open eyes
            elapsed = 0f;
            while (elapsed < halfDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / halfDuration);
                SetBlinkWeight((1f - t) * blinkClosedWeight);
                yield return null;
            }

            SetBlinkWeight(0f);
        }

        private void SetBlinkWeight(float weight)
        {
            if (_leftBlinkIndex >= 0)
                skinnedMeshRenderer.SetBlendShapeWeight(_leftBlinkIndex, weight);
            if (_rightBlinkIndex >= 0)
                skinnedMeshRenderer.SetBlendShapeWeight(_rightBlinkIndex, weight);
        }
    }
}
