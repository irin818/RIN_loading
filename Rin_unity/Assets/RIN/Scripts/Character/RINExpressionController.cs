using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Manages RIN's facial expressions via BlendShapes.
    /// If BlendShapes are unavailable, expressions are tracked in state only (no visual change).
    /// Provides a clean public API for other systems to set expressions.
    /// </summary>
    public class RINExpressionController : MonoBehaviour
    {
        [Header("BlendShape Setup")]
        [Tooltip("The SkinnedMeshRenderer with facial BlendShapes.")]
        public SkinnedMeshRenderer faceRenderer;

        [Header("BlendShape Names")]
        public string smileBlendShape = "smile";
        public string curiousBlendShape = "brow_raise";
        public string seriousBlendShape = "brow_lower";
        public string glitchBlendShape = "glitch";

        [Header("Transition")]
        [Tooltip("How fast expressions blend in/out.")]
        public float transitionSpeed = 3f;

        public string CurrentExpression { get; private set; } = "Neutral";

        private int _smileIndex = -1;
        private int _curiousIndex = -1;
        private int _seriousIndex = -1;
        private int _glitchIndex = -1;
        private bool _hasBlendShapes;

        private float _targetSmile;
        private float _targetCurious;
        private float _targetSerious;
        private float _targetGlitch;

        private float _currentSmile;
        private float _currentCurious;
        private float _currentSerious;
        private float _currentGlitch;

        private void Awake()
        {
            if (faceRenderer == null)
                faceRenderer = GetComponentInChildren<SkinnedMeshRenderer>();

            if (faceRenderer == null || faceRenderer.sharedMesh == null || faceRenderer.sharedMesh.blendShapeCount == 0)
            {
                Debug.LogWarning($"[RINExpressionController] No BlendShapes available on '{gameObject.name}'. Expressions will be state-only.");
                enabled = true; // Still enabled for state tracking
                return;
            }

            var mesh = faceRenderer.sharedMesh;
            _smileIndex = mesh.GetBlendShapeIndex(smileBlendShape);
            _curiousIndex = mesh.GetBlendShapeIndex(curiousBlendShape);
            _seriousIndex = mesh.GetBlendShapeIndex(seriousBlendShape);
            _glitchIndex = mesh.GetBlendShapeIndex(glitchBlendShape);

            _hasBlendShapes = _smileIndex >= 0 || _curiousIndex >= 0 || _seriousIndex >= 0 || _glitchIndex >= 0;

            if (!_hasBlendShapes)
                Debug.LogWarning($"[RINExpressionController] None of the configured BlendShape names found. Expressions will be state-only.");
        }

        private void Update()
        {
            if (!_hasBlendShapes) return;

            // Smooth transitions
            _currentSmile = Mathf.Lerp(_currentSmile, _targetSmile, transitionSpeed * Time.deltaTime);
            _currentCurious = Mathf.Lerp(_currentCurious, _targetCurious, transitionSpeed * Time.deltaTime);
            _currentSerious = Mathf.Lerp(_currentSerious, _targetSerious, transitionSpeed * Time.deltaTime);
            _currentGlitch = Mathf.Lerp(_currentGlitch, _targetGlitch, transitionSpeed * Time.deltaTime);

            if (_smileIndex >= 0) faceRenderer.SetBlendShapeWeight(_smileIndex, _currentSmile);
            if (_curiousIndex >= 0) faceRenderer.SetBlendShapeWeight(_curiousIndex, _currentCurious);
            if (_seriousIndex >= 0) faceRenderer.SetBlendShapeWeight(_seriousIndex, _currentSerious);
            if (_glitchIndex >= 0) faceRenderer.SetBlendShapeWeight(_glitchIndex, _currentGlitch);
        }

        /// <summary>Set a named expression.</summary>
        public void SetExpression(string expressionName)
        {
            CurrentExpression = expressionName;
            ResetTargets();

            switch (expressionName)
            {
                case "Smile":
                    _targetSmile = 80f;
                    break;
                case "Curious":
                    _targetCurious = 70f;
                    break;
                case "Serious":
                    _targetSerious = 60f;
                    break;
                case "Glitch":
                    _targetGlitch = 100f;
                    _targetCurious = 40f;
                    break;
                case "Neutral":
                default:
                    // All zero (handled by ResetTargets)
                    CurrentExpression = "Neutral";
                    break;
            }
        }

        /// <summary>Set smile intensity directly (0-100).</summary>
        public void SetSmile(float value)
        {
            _targetSmile = Mathf.Clamp(value, 0f, 100f);
        }

        /// <summary>Reset all expressions to neutral.</summary>
        public void ResetExpression()
        {
            ResetTargets();
            CurrentExpression = "Neutral";
        }

        private void ResetTargets()
        {
            _targetSmile = 0f;
            _targetCurious = 0f;
            _targetSerious = 0f;
            _targetGlitch = 0f;
        }
    }
}
