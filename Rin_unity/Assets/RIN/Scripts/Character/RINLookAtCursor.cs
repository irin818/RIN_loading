using UnityEngine;

namespace RIN.Character
{
    /// <summary>
    /// Makes RIN's head and eyes subtly follow the mouse cursor position.
    /// Gracefully disables itself if no head bone is assigned.
    /// Uses LateUpdate for smooth camera-relative tracking.
    /// </summary>
    public class RINLookAtCursor : MonoBehaviour
    {
        [Header("Bone References")]
        [Tooltip("The head bone Transform (e.g., Head or Neck).")]
        public Transform headBone;

        [Tooltip("Left eye bone (optional).")]
        public Transform leftEyeBone;

        [Tooltip("Right eye bone (optional).")]
        public Transform rightEyeBone;

        [Header("Rotation Limits")]
        [Tooltip("Maximum horizontal rotation in degrees.")]
        public float maxYaw = 25f;

        [Tooltip("Maximum vertical rotation in degrees.")]
        public float maxPitch = 15f;

        [Header("Smoothing")]
        [Tooltip("How quickly the head follows the cursor (higher = faster).")]
        public float smooth = 5f;

        [Tooltip("How much the cursor influences the look direction (0-1).")]
        [Range(0f, 1f)]
        public float weight = 0.6f;

        private Camera _mainCamera;
        private Quaternion _headBaseRotation;
        private Quaternion _leftEyeBaseRotation;
        private Quaternion _rightEyeBaseRotation;
        private Vector2 _currentLookOffset;

        private void Awake()
        {
            if (headBone == null)
            {
                Debug.LogWarning($"[RINLookAtCursor] No headBone assigned on '{gameObject.name}'. Disabling.");
                enabled = false;
                return;
            }

            _headBaseRotation = headBone.localRotation;
            if (leftEyeBone != null) _leftEyeBaseRotation = leftEyeBone.localRotation;
            if (rightEyeBone != null) _rightEyeBaseRotation = rightEyeBone.localRotation;
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            if (_mainCamera == null)
            {
                Debug.LogWarning("[RINLookAtCursor] No main camera found. Disabling.");
                enabled = false;
            }
        }

        private void LateUpdate()
        {
            if (_mainCamera == null || headBone == null) return;

            // Convert mouse position to viewport space
            Vector3 mouseScreen = Input.mousePosition;
            Vector3 viewportPoint = _mainCamera.ScreenToViewportPoint(mouseScreen);

            // Remap from [0,1] to [-1,1] so center is (0,0)
            float targetYaw = (viewportPoint.x - 0.5f) * 2f * maxYaw;
            float targetPitch = (viewportPoint.y - 0.5f) * 2f * maxPitch;

            // Clamp
            targetYaw = Mathf.Clamp(targetYaw, -maxYaw, maxYaw);
            targetPitch = Mathf.Clamp(targetPitch, -maxPitch, maxPitch);

            Vector2 targetOffset = new Vector2(targetYaw, targetPitch);
            _currentLookOffset = Vector2.Lerp(_currentLookOffset, targetOffset, smooth * Time.deltaTime);

            // Apply to head: yaw around Y (world up), pitch around X (local right)
            Quaternion yawRot = Quaternion.Euler(0f, _currentLookOffset.x * weight, 0f);
            Quaternion pitchRot = Quaternion.Euler(-_currentLookOffset.y * weight, 0f, 0f);

            headBone.localRotation = _headBaseRotation * yawRot * pitchRot;

            // Apply to eyes (stronger effect)
            float eyeWeight = Mathf.Min(weight * 1.3f, 1f);
            Quaternion eyeYaw = Quaternion.Euler(0f, _currentLookOffset.x * eyeWeight, 0f);
            Quaternion eyePitch = Quaternion.Euler(-_currentLookOffset.y * eyeWeight, 0f, 0f);

            if (leftEyeBone != null)
                leftEyeBone.localRotation = _leftEyeBaseRotation * eyeYaw * eyePitch;
            if (rightEyeBone != null)
                rightEyeBone.localRotation = _rightEyeBaseRotation * eyeYaw * eyePitch;
        }

        private void OnDisable()
        {
            // Reset to base rotations when disabled
            if (headBone != null) headBone.localRotation = _headBaseRotation;
            if (leftEyeBone != null) leftEyeBone.localRotation = _leftEyeBaseRotation;
            if (rightEyeBone != null) rightEyeBone.localRotation = _rightEyeBaseRotation;
        }
    }
}
