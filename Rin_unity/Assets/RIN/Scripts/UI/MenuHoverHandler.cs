using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace RIN.UI
{
    /// <summary>
    /// Handles hover and click events on menu buttons,
    /// forwarding them to RINInteractionController with the menu ID.
    /// Attach to each menu button GameObject.
    /// </summary>
    public class MenuHoverHandler : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler
    {
        [Header("Menu Identity")]
        [Tooltip("Unique identifier for this menu item (e.g., StartSession, Settings).")]
        public string menuId = "Unknown";

        [Header("Visual Feedback")]
        [Tooltip("Optional target Graphic to tint on hover.")]
        public Graphic targetGraphic;

        [Tooltip("Normal color.")]
        public Color normalColor = new Color(0f, 0.9f, 0.3f, 0.7f);

        [Tooltip("Hover color (brighter).")]
        public Color hoverColor = new Color(0f, 1f, 0.5f, 1f);

        [Tooltip("Hover scale multiplier.")]
        public float hoverScale = 1.05f;

        [Header("Audio (Optional)")]
        [Tooltip("Sound played on hover.")]
        public AudioClip hoverSound;

        [Tooltip("Sound played on click.")]
        public AudioClip clickSound;

        private RIN.Character.RINInteractionController _rinController;
        private Vector3 _baseScale;
        private AudioSource _audioSource;

        private void Awake()
        {
            _baseScale = transform.localScale;
            _audioSource = GetComponent<AudioSource>();

            // Auto-find RIN interaction controller
            var rin = GameObject.FindGameObjectWithTag("RIN");
            if (rin != null)
                _rinController = rin.GetComponent<RIN.Character.RINInteractionController>();

            if (_rinController == null)
            {
                // Try finding anywhere in scene
                _rinController = FindFirstObjectByType<RIN.Character.RINInteractionController>();
            }

            if (_rinController == null)
                Debug.LogWarning($"[MenuHoverHandler] No RINInteractionController found in scene for menu '{menuId}'.");
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            // Visual feedback
            if (targetGraphic != null)
                targetGraphic.color = hoverColor;

            transform.localScale = _baseScale * hoverScale;

            // Audio
            if (_audioSource != null && hoverSound != null)
                _audioSource.PlayOneShot(hoverSound);

            // Notify RIN
            _rinController?.OnMenuHover(menuId);
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            // Reset visual
            if (targetGraphic != null)
                targetGraphic.color = normalColor;

            transform.localScale = _baseScale;

            // Notify RIN
            _rinController?.OnMenuExit(menuId);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            // Audio
            if (_audioSource != null && clickSound != null)
                _audioSource.PlayOneShot(clickSound);

            // Notify RIN
            _rinController?.OnMenuClick(menuId);
        }

        private void OnDisable()
        {
            // Reset visual state
            if (targetGraphic != null)
                targetGraphic.color = normalColor;
            transform.localScale = _baseScale;
        }
    }
}
