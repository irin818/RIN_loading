using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using System.IO;

namespace RIN.Editor
{
    /// <summary>
    /// One-shot Editor script that creates the complete RIN Main Menu scene.
    /// Run via: Unity -batchmode -executeMethod RIN.Editor.SceneBuilder.BuildAll
    /// </summary>
    public static class SceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/MainMenu/RIN_MainMenu.unity";
        private const string PrefabPath = "Assets/RIN/Prefabs/RIN_MainMenu.prefab";

        [MenuItem("RIN/Build Main Menu Scene")]
        public static void BuildAll()
        {
            Debug.Log("[SceneBuilder] === Starting RIN Main Menu scene build ===");

            // Step 1: Create scene
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "RIN_MainMenu";

            // Step 2: Create root
            var root = new GameObject("_MainMenuSceneRoot");

            // Step 3: Build environment
            BuildEnvironment(root.transform);

            // Step 4: Create materials
            var materials = CreateMaterials();

            // Step 5: Import and setup RIN
            var rinInstance = SetupRINCharacter(root.transform, materials);
            if (rinInstance != null) rinInstance.tag = "RIN";

            // Step 6: Setup lighting
            SetupLighting(root.transform);

            // Step 7: Setup camera
            SetupCamera(root.transform);

            // Step 8: Create UI
            SetupUI(root.transform, rinInstance);

            // Step 9: Create Animator Controller
            CreateAnimatorController();

            // Step 10: Create idle animation placeholder
            CreatePlaceholderAnimations();

            // Step 11: Add systems
            AddSystemScripts(rinInstance);

            // Step 12: Save scene
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[SceneBuilder] Scene saved to {ScenePath}");

            // Step 13: Add to build settings
            AddSceneToBuild(ScenePath);

            Debug.Log("[SceneBuilder] === Build complete ===");
        }

        #region Environment

        private static void BuildEnvironment(Transform parent)
        {
            var envRoot = new GameObject("Environment").transform;
            envRoot.SetParent(parent);

            // Floor
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(envRoot);
            floor.transform.localPosition = new Vector3(0f, -0.05f, 0f);
            floor.transform.localScale = new Vector3(10f, 0.1f, 10f);

            // Back wall
            var backWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            backWall.name = "BackWall";
            backWall.transform.SetParent(envRoot);
            backWall.transform.localPosition = new Vector3(0f, 2.5f, -5f);
            backWall.transform.localScale = new Vector3(10f, 5f, 0.1f);

            // Left wall
            var leftWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            leftWall.name = "LeftWall";
            leftWall.transform.SetParent(envRoot);
            leftWall.transform.localPosition = new Vector3(-5f, 2.5f, 0f);
            leftWall.transform.localScale = new Vector3(0.1f, 5f, 10f);

            // Right wall
            var rightWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rightWall.name = "RightWall";
            rightWall.transform.SetParent(envRoot);
            rightWall.transform.localPosition = new Vector3(5f, 2.5f, 0f);
            rightWall.transform.localScale = new Vector3(0.1f, 5f, 10f);

            // Ceiling
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(envRoot);
            ceiling.transform.localPosition = new Vector3(0f, 5f, 0f);
            ceiling.transform.localScale = new Vector3(10f, 0.1f, 10f);

            // Desk
            var desk = GameObject.CreatePrimitive(PrimitiveType.Cube);
            desk.name = "Desk";
            desk.transform.SetParent(envRoot);
            desk.transform.localPosition = new Vector3(0.8f, 0.8f, 1.5f);
            desk.transform.localScale = new Vector3(2f, 0.08f, 0.8f);

            // Monitor
            var monitorBase = GameObject.CreatePrimitive(PrimitiveType.Cube);
            monitorBase.name = "MonitorBase";
            monitorBase.transform.SetParent(envRoot);
            monitorBase.transform.localPosition = new Vector3(0.8f, 0.86f, 1.2f);
            monitorBase.transform.localScale = new Vector3(0.15f, 0.1f, 0.15f);

            var monitorScreen = GameObject.CreatePrimitive(PrimitiveType.Cube);
            monitorScreen.name = "MonitorScreen";
            monitorScreen.transform.SetParent(envRoot);
            monitorScreen.transform.localPosition = new Vector3(0.8f, 1.25f, 1.15f);
            monitorScreen.transform.localScale = new Vector3(1.2f, 0.7f, 0.05f);

            // Glowing panels (decorative strips on walls)
            CreateGlowPanel(envRoot, "GlowPanel_Left", new Vector3(-4.95f, 2f, -1f), new Vector3(0.05f, 2f, 0.3f));
            CreateGlowPanel(envRoot, "GlowPanel_Right", new Vector3(4.95f, 2f, -1f), new Vector3(0.05f, 2f, 0.3f));
            CreateGlowPanel(envRoot, "GlowPanel_Back", new Vector3(0f, 4.9f, -4.95f), new Vector3(6f, 0.05f, 0.05f));
            CreateGlowPanel(envRoot, "GlowPanel_Floor", new Vector3(0f, 0.01f, 0f), new Vector3(0.05f, 0.02f, 4f));

            // Data screen (floating panel)
            var dataScreen = GameObject.CreatePrimitive(PrimitiveType.Quad);
            dataScreen.name = "DataScreen";
            dataScreen.transform.SetParent(envRoot);
            dataScreen.transform.localPosition = new Vector3(-3f, 3f, -4.8f);
            dataScreen.transform.localScale = new Vector3(1.5f, 1f, 1f);
            dataScreen.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
        }

        private static void CreateGlowPanel(Transform parent, string name, Vector3 pos, Vector3 scale)
        {
            var panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = name;
            panel.transform.SetParent(parent);
            panel.transform.localPosition = pos;
            panel.transform.localScale = scale;
        }

        #endregion

        #region Materials

        private static Material CreateMaterial(string name, Color color, Color? emissionColor = null, float emissionStrength = 0f)
        {
            var mat = new Material(Shader.Find("Standard"));
            mat.name = name;
            mat.color = color;

            if (emissionColor.HasValue && emissionStrength > 0f)
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", emissionColor.Value * emissionStrength);
                mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }

            AssetDatabase.CreateAsset(mat, $"Assets/RIN/Materials/{name}.mat");
            return mat;
        }

        private static Material[] CreateMaterials()
        {
            Directory.CreateDirectory("Assets/RIN/Materials");

            var mats = new Material[12];

            // Environment
            mats[0] = CreateMaterial("M_Floor", new Color(0.05f, 0.05f, 0.06f), new Color(0f, 0.3f, 0f), 0.15f);
            mats[1] = CreateMaterial("M_Wall", new Color(0.03f, 0.04f, 0.03f), null);
            mats[2] = CreateMaterial("M_GlowPanel", new Color(0f, 0f, 0f), new Color(0f, 1f, 0.3f), 2f);
            mats[3] = CreateMaterial("M_Desk", new Color(0.08f, 0.08f, 0.09f), new Color(0f, 0.2f, 0f), 0.3f);
            mats[4] = CreateMaterial("M_MonitorScreen", new Color(0.01f, 0.03f, 0.01f), new Color(0f, 0.5f, 0.1f), 0.8f);
            mats[5] = CreateMaterial("M_MonitorBase", new Color(0.1f, 0.1f, 0.1f), null);
            mats[6] = CreateMaterial("M_DataScreen", new Color(0f, 0.02f, 0f), new Color(0f, 0.8f, 0.3f), 1f);

            // RIN character materials
            mats[7] = CreateMaterial("M_Skin", new Color(0.25f, 0.25f, 0.25f), null);
            mats[8] = CreateMaterial("M_Hair", new Color(0.15f, 0.15f, 0.15f), new Color(0f, 0.15f, 0f), 0.2f);
            mats[9] = CreateMaterial("M_Eye", new Color(0f, 0f, 0f), new Color(0f, 1f, 0.3f), 2f);
            mats[10] = CreateMaterial("M_Outfit", new Color(0.08f, 0.08f, 0.08f), new Color(0f, 0.15f, 0f), 0.15f);
            mats[11] = CreateMaterial("M_Accent", new Color(0.06f, 0.06f, 0.06f), new Color(0f, 0.6f, 0.2f), 1f);

            return mats;
        }

        #endregion

        #region RIN Character

        private static GameObject SetupRINCharacter(Transform parent, Material[] materials)
        {
            // Find the FBX asset
            string fbxPath = "Assets/RIN/Models/RIN.fbx";
            var fbxAsset = AssetDatabase.LoadAssetAtPath<GameObject>(fbxPath);

            if (fbxAsset == null)
            {
                Debug.LogError($"[SceneBuilder] RIN.fbx not found at {fbxPath}!");
                return null;
            }

            Debug.Log($"[SceneBuilder] Found RIN FBX at {fbxPath}");

            // Check FBX import settings
            string assetPath = AssetDatabase.GetAssetPath(fbxAsset);
            ModelImporter importer = AssetImporter.GetAtPath(assetPath) as ModelImporter;
            if (importer != null)
            {
                Debug.Log($"[SceneBuilder] FBX Info: AnimationType={importer.animationType}, " +
                          $"ImportBlendShapes={importer.importBlendShapes}, " +
                          $"ImportMaterials={importer.materialImportMode}");

                // Log bone info
                if (importer.animationType == ModelImporterAnimationType.Human)
                    Debug.Log("[SceneBuilder] Rig type: Human");
                else if (importer.animationType == ModelImporterAnimationType.Generic)
                    Debug.Log("[SceneBuilder] Rig type: Generic");
                else
                    Debug.Log("[SceneBuilder] Rig type: None/Legacy");
            }

            // Instance in scene
            var instance = Object.Instantiate(fbxAsset, parent);
            instance.name = "RIN";

            // Position: center-right
            instance.transform.localPosition = new Vector3(0.5f, 0f, -1f);
            instance.transform.localRotation = Quaternion.Euler(0f, -15f, 0f); // Slightly facing camera

            // Scale to make reasonable size (adjust based on FBX)
            // FBX models vary wildly in scale; start with a safe default
            instance.transform.localScale = Vector3.one;

            // Auto-detect renderers and apply materials
            var skinnedRenderers = instance.GetComponentsInChildren<SkinnedMeshRenderer>();
            var meshRenderers = instance.GetComponentsInChildren<MeshRenderer>();
            Debug.Log($"[SceneBuilder] Found {skinnedRenderers.Length} SkinnedMeshRenderer(s) and {meshRenderers.Length} MeshRenderer(s) in RIN FBX.");

            foreach (var smr in skinnedRenderers)
            {
                var matList = new Material[smr.sharedMaterials.Length];
                for (int i = 0; i < matList.Length; i++)
                    matList[i] = materials[10]; // M_Outfit
                smr.sharedMaterials = matList;
            }
            foreach (var mr in meshRenderers)
            {
                var matList = new Material[mr.sharedMaterials.Length];
                for (int i = 0; i < matList.Length; i++)
                    matList[i] = materials[10]; // M_Outfit as default
                mr.sharedMaterials = matList;
                Debug.Log($"[SceneBuilder]   MeshRenderer: {mr.name}, Materials: {mr.sharedMaterials.Length}");
            }

            // Check for skeleton/bones
            var animator = instance.GetComponent<Animator>();
            if (animator == null)
                animator = instance.AddComponent<Animator>();

            if (animator.avatar == null)
            {
                Debug.LogWarning("[SceneBuilder] No Avatar on RIN FBX. Animator will work without one, but Humanoid animations won't apply.");
            }

            // Log bone hierarchy for debugging
            LogBoneHierarchy(instance.transform, "", 3);

            // Save as prefab
            Directory.CreateDirectory("Assets/RIN/Prefabs");
            PrefabUtility.SaveAsPrefabAsset(instance, PrefabPath);
            Debug.Log($"[SceneBuilder] RIN prefab saved to {PrefabPath}");

            return instance;
        }

        private static void LogBoneHierarchy(Transform t, string indent, int maxDepth)
        {
            if (maxDepth <= 0) return;
            string type = t.GetComponent<SkinnedMeshRenderer>() != null ? " [SkinnedMesh]" : "";
            Debug.Log($"[SceneBuilder] {indent}{t.name}{type}");
            foreach (Transform child in t)
            {
                LogBoneHierarchy(child, indent + "  ", maxDepth - 1);
            }
        }

        #endregion

        #region Lighting

        private static void SetupLighting(Transform parent)
        {
            var lightsRoot = new GameObject("Lighting").transform;
            lightsRoot.SetParent(parent);

            // Ambient settings
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.02f, 0.03f, 0.02f);
            RenderSettings.ambientEquatorColor = new Color(0.01f, 0.02f, 0.01f);
            RenderSettings.ambientGroundColor = new Color(0.03f, 0.04f, 0.03f);

            // Key light (main directional)
            var keyLight = new GameObject("KeyLight");
            keyLight.transform.SetParent(lightsRoot);
            keyLight.transform.localPosition = new Vector3(2f, 4f, 2f);
            keyLight.transform.localRotation = Quaternion.Euler(50f, -30f, 0f);
            var keyComp = keyLight.AddComponent<Light>();
            keyComp.type = LightType.Directional;
            keyComp.color = new Color(0.8f, 1f, 0.9f);
            keyComp.intensity = 0.6f;
            keyComp.shadows = LightShadows.Soft;

            // Fill light (softer, from side)
            var fillLight = new GameObject("FillLight");
            fillLight.transform.SetParent(lightsRoot);
            fillLight.transform.localPosition = new Vector3(-2f, 2f, 0f);
            fillLight.transform.localRotation = Quaternion.Euler(30f, 60f, 0f);
            var fillComp = fillLight.AddComponent<Light>();
            fillComp.type = LightType.Directional;
            fillComp.color = new Color(0.6f, 0.7f, 0.7f);
            fillComp.intensity = 0.25f;

            // Rim/back light (neon green accent)
            var rimLight = new GameObject("RimLight");
            rimLight.transform.SetParent(lightsRoot);
            rimLight.transform.localPosition = new Vector3(0f, 2.5f, -3f);
            rimLight.transform.localRotation = Quaternion.Euler(20f, 180f, 0f);
            var rimComp = rimLight.AddComponent<Light>();
            rimComp.type = LightType.Directional;
            rimComp.color = new Color(0f, 1f, 0.4f);
            rimComp.intensity = 0.4f;

            // Monitor glow (point light near monitor)
            var monitorGlow = new GameObject("MonitorGlow");
            monitorGlow.transform.SetParent(lightsRoot);
            monitorGlow.transform.localPosition = new Vector3(0.8f, 1.3f, 1.5f);
            var monitorComp = monitorGlow.AddComponent<Light>();
            monitorComp.type = LightType.Point;
            monitorComp.color = new Color(0f, 1f, 0.3f);
            monitorComp.intensity = 0.5f;
            monitorComp.range = 3f;
        }

        #endregion

        #region Camera

        private static void SetupCamera(Transform parent)
        {
            var camObj = new GameObject("MainCamera");
            camObj.transform.SetParent(parent);
            camObj.transform.localPosition = new Vector3(0f, 1.5f, -3f);
            camObj.transform.localRotation = Quaternion.Euler(5f, 0f, 0f);

            var cam = camObj.AddComponent<Camera>();
            cam.fieldOfView = 50f;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 50f;
            cam.backgroundColor = new Color(0.02f, 0.03f, 0.02f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.tag = "MainCamera";

            // Audio Listener for future use
            camObj.AddComponent<AudioListener>();
        }

        #endregion

        #region UI

        private static void SetupUI(Transform parent, GameObject rinInstance)
        {
            var canvasObj = new GameObject("MainMenuCanvas");
            canvasObj.transform.SetParent(parent);
            var canvas = canvasObj.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasObj.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasObj.AddComponent<GraphicRaycaster>();

            // Panel background (semi-transparent dark panel on left side)
            var panel = new GameObject("MenuPanel");
            panel.transform.SetParent(canvasObj.transform);
            var panelRect = panel.AddComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.02f, 0.1f);
            panelRect.anchorMax = new Vector2(0.3f, 0.9f);
            panelRect.offsetMin = Vector2.zero;
            panelRect.offsetMax = Vector2.zero;
            var panelImg = panel.AddComponent<Image>();
            panelImg.color = new Color(0f, 0.05f, 0.02f, 0.85f);

            // Title text
            var title = CreateUIText(panel.transform, "Title", "R I N", 36, TextAnchor.UpperCenter);
            var titleRT = title.GetComponent<RectTransform>();
            titleRT.anchorMin = new Vector2(0.05f, 0.85f);
            titleRT.anchorMax = new Vector2(0.95f, 0.97f);
            titleRT.offsetMin = Vector2.zero;
            titleRT.offsetMax = Vector2.zero;

            // Status text
            var status = CreateUIText(panel.transform, "StatusText", "", 14, TextAnchor.MiddleCenter);
            status.color = new Color(0f, 0.8f, 0.3f);
            var statusRT = status.GetComponent<RectTransform>();
            statusRT.anchorMin = new Vector2(0.05f, 0.75f);
            statusRT.anchorMax = new Vector2(0.95f, 0.84f);
            statusRT.offsetMin = Vector2.zero;
            statusRT.offsetMax = Vector2.zero;

            // Menu buttons
            string[] menuItems = { "START SESSION", "CONTINUE MEMORY", "MEMORY ARCHIVE", "SETTINGS", "SHUTDOWN" };
            string[] menuIds = { "StartSession", "ContinueMemory", "MemoryArchive", "Settings", "Shutdown" };

            float startY = 0.68f;
            float spacing = 0.1f;

            for (int i = 0; i < menuItems.Length; i++)
            {
                CreateMenuButton(panel.transform, menuItems[i], menuIds[i],
                    new Vector2(0.1f, startY - i * spacing),
                    new Vector2(0.9f, startY - i * spacing + 0.07f));
            }

            // Add MainMenuController to canvas
            var menuCtrl = canvasObj.AddComponent<RIN.UI.MainMenuController>();
            // Buttons will be wired in UpdateButtonReferences
            // (can't set via reflection easily; use Find at runtime)

            // Add IdleWatcher
            var idleWatcher = canvasObj.AddComponent<RIN.Systems.IdleWatcher>();
        }

        private static Text CreateUIText(Transform parent, string name, string text, int fontSize, TextAnchor alignment)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent);
            var txt = go.AddComponent<Text>();
            txt.text = text;
            txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            txt.fontSize = fontSize;
            txt.alignment = alignment;
            txt.color = new Color(0f, 0.9f, 0.4f);
            return txt;
        }

        private static void CreateMenuButton(Transform parent, string label, string menuId, Vector2 anchorMin, Vector2 anchorMax)
        {
            var go = new GameObject($"Btn_{menuId}");
            go.transform.SetParent(parent);

            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;

            var img = go.AddComponent<Image>();
            img.color = new Color(0f, 0.15f, 0.03f, 0.9f);

            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;

            // Hover colors
            var colors = btn.colors;
            colors.normalColor = new Color(0f, 0.15f, 0.03f, 0.9f);
            colors.highlightedColor = new Color(0f, 0.3f, 0.05f, 1f);
            colors.pressedColor = new Color(0f, 0.4f, 0.1f, 1f);
            btn.colors = colors;

            // Label text inside button
            var labelObj = new GameObject("Label");
            labelObj.transform.SetParent(go.transform);
            var labelRT = labelObj.AddComponent<RectTransform>();
            labelRT.anchorMin = Vector2.zero;
            labelRT.anchorMax = Vector2.one;
            labelRT.offsetMin = new Vector2(10f, 2f);
            labelRT.offsetMax = new Vector2(-10f, -2f);
            var labelTxt = labelObj.AddComponent<Text>();
            labelTxt.text = label;
            labelTxt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            labelTxt.fontSize = 16;
            labelTxt.alignment = TextAnchor.MiddleLeft;
            labelTxt.color = new Color(0f, 0.9f, 0.4f);

            // MenuHoverHandler
            var hover = go.AddComponent<RIN.UI.MenuHoverHandler>();
            hover.menuId = menuId;
            hover.targetGraphic = img;
        }

        #endregion

        #region Animator Controller and Placeholder Animations

        private static void CreateAnimatorController()
        {
            string controllerPath = "Assets/RIN/Animations/RIN_MainMenu_Animator.controller";

            var controller = AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
            if (controller == null)
            {
                Debug.LogError("[SceneBuilder] Failed to create Animator Controller!");
                return;
            }

            // Get the base layer
            var baseLayer = controller.layers[0];

            // Create states (initially empty, to be populated with placeholder anims)
            AddAnimatorState(controller, baseLayer, "Idle");
            AddAnimatorState(controller, baseLayer, "Greeting");
            AddAnimatorState(controller, baseLayer, "HoverReact");
            AddAnimatorState(controller, baseLayer, "ClickReact");
            AddAnimatorState(controller, baseLayer, "LongIdleReact");

            // Set Idle as default
            baseLayer.stateMachine.defaultState = baseLayer.stateMachine.states[0].state;

            // Add parameters
            controller.AddParameter("Greeting", AnimatorControllerParameterType.Trigger);
            controller.AddParameter("HoverReact", AnimatorControllerParameterType.Trigger);
            controller.AddParameter("ClickReact", AnimatorControllerParameterType.Trigger);
            controller.AddParameter("LongIdleReact", AnimatorControllerParameterType.Trigger);
            controller.AddParameter("ExpressionIndex", AnimatorControllerParameterType.Int);

            Debug.Log($"[SceneBuilder] Animator Controller created at {controllerPath}");

            // Assign to RIN prefab
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
            if (prefab != null)
            {
                var animator = prefab.GetComponent<Animator>();
                if (animator == null) animator = prefab.AddComponent<Animator>();
                animator.runtimeAnimatorController = controller;
                PrefabUtility.SavePrefabAsset(prefab);
                Debug.Log("[SceneBuilder] Animator Controller assigned to RIN prefab.");
            }
        }

        private static void AddAnimatorState(AnimatorController controller, AnimatorControllerLayer layer, string name)
        {
            var state = layer.stateMachine.AddState(name);
            state.writeDefaultValues = true;
        }

        private static void CreatePlaceholderAnimations()
        {
            // Create a simple idle animation clip (subtle up/down breathing motion)
            string clipPath = "Assets/RIN/Animations/RIN_Idle.anim";
            var idleClip = CreateBreathingClip(clipPath, "Idle");

            string greetingPath = "Assets/RIN/Animations/RIN_Greeting.anim";
            var greetingClip = CreateNodClip(greetingPath, "Greeting", 30f);

            string hoverPath = "Assets/RIN/Animations/RIN_HoverReact.anim";
            var hoverClip = CreateNodClip(hoverPath, "HoverReact", 8f);

            string clickPath = "Assets/RIN/Animations/RIN_ClickReact.anim";
            var clickClip = CreateNodClip(clickPath, "ClickReact", 15f);

            string longIdlePath = "Assets/RIN/Animations/RIN_LongIdleReact.anim";
            var longIdleClip = CreateTiltHeadClip(longIdlePath, "LongIdleReact");

            // Assign clips to Animator Controller states
            string controllerPath = "Assets/RIN/Animations/RIN_MainMenu_Animator.controller";
            var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(controllerPath);
            if (controller != null)
            {
                AssignClipToState(controller, "Idle", idleClip);
                AssignClipToState(controller, "Greeting", greetingClip);
                AssignClipToState(controller, "HoverReact", hoverClip);
                AssignClipToState(controller, "ClickReact", clickClip);
                AssignClipToState(controller, "LongIdleReact", longIdleClip);

                // Add transitions: all non-idle states return to Idle
                AddReturnToIdle(controller, "Greeting", 0.7f);
                AddReturnToIdle(controller, "HoverReact", 0.3f);
                AddReturnToIdle(controller, "ClickReact", 0.3f);
                AddReturnToIdle(controller, "LongIdleReact", 1f);
            }
        }

        private static AnimationClip CreateBreathingClip(string path, string name)
        {
            var clip = new AnimationClip();
            clip.name = name;
            clip.legacy = false;

            // Simple Y position oscillation for breathing effect
            // Using a dummy curve on a "Root" transform
            AnimationCurve curve = AnimationCurve.EaseInOut(0f, 0f, 2f, 0.02f);
            curve.preWrapMode = WrapMode.PingPong;
            curve.postWrapMode = WrapMode.PingPong;
            clip.SetCurve("", typeof(Transform), "localPosition.y", curve);

            AssetDatabase.CreateAsset(clip, path);
            Debug.Log($"[SceneBuilder] Created animation: {path}");
            return clip;
        }

        private static AnimationClip CreateNodClip(string path, string name, float angle)
        {
            var clip = new AnimationClip();
            clip.name = name;
            clip.legacy = false;

            // Nod: rotate X forward and back
            Keyframe[] keys = {
                new Keyframe(0f, 0f),
                new Keyframe(0.15f, angle),
                new Keyframe(0.5f, 0f)
            };
            AnimationCurve curve = new AnimationCurve(keys);
            clip.SetCurve("", typeof(Transform), "localEulerAnglesRaw.x", curve);

            AssetDatabase.CreateAsset(clip, path);
            Debug.Log($"[SceneBuilder] Created animation: {path}");
            return clip;
        }

        private static AnimationClip CreateTiltHeadClip(string path, string name)
        {
            var clip = new AnimationClip();
            clip.name = name;
            clip.legacy = false;

            // Tilt head: rotate Z
            Keyframe[] keys = {
                new Keyframe(0f, 0f),
                new Keyframe(0.5f, 12f),
                new Keyframe(1.5f, -8f),
                new Keyframe(2.5f, 5f),
                new Keyframe(3f, 0f)
            };
            AnimationCurve curve = new AnimationCurve(keys);
            clip.SetCurve("", typeof(Transform), "localEulerAnglesRaw.z", curve);

            AssetDatabase.CreateAsset(clip, path);
            Debug.Log($"[SceneBuilder] Created animation: {path}");
            return clip;
        }

        private static void AssignClipToState(AnimatorController controller, string stateName, AnimationClip clip)
        {
            var state = FindState(controller, stateName);
            if (state != null && clip != null)
            {
                state.motion = clip;
            }
        }

        private static void AddReturnToIdle(AnimatorController controller, string fromState, float exitTime)
        {
            var baseLayer = controller.layers[0];
            var from = FindState(controller, fromState);
            var idle = FindState(controller, "Idle");

            if (from != null && idle != null)
            {
                var transition = from.AddTransition(idle);
                transition.hasExitTime = true;
                transition.exitTime = exitTime;
                transition.duration = 0.2f;
            }
        }

        private static AnimatorState FindState(AnimatorController controller, string name)
        {
            foreach (var state in controller.layers[0].stateMachine.states)
            {
                if (state.state.name == name)
                    return state.state;
            }
            return null;
        }

        #endregion

        #region System Scripts

        private static void AddSystemScripts(GameObject rinInstance)
        {
            if (rinInstance == null) return;

            // Add all character scripts
            rinInstance.AddComponent<RIN.Character.RINLookAtCursor>();
            rinInstance.AddComponent<RIN.Character.RINBlinkController>();
            rinInstance.AddComponent<RIN.Character.RINTailSway>();
            rinInstance.AddComponent<RIN.Character.RINEarTwitch>();
            rinInstance.AddComponent<RIN.Character.RINExpressionController>();

            // RINInteractionController is already required
            var interactionCtrl = rinInstance.GetComponent<RIN.Character.RINInteractionController>();
            if (interactionCtrl == null)
            {
                interactionCtrl = rinInstance.AddComponent<RIN.Character.RINInteractionController>();
            }

            Debug.Log("[SceneBuilder] Character scripts added to RIN instance.");
        }

        #endregion

        #region Build Settings

        private static void AddSceneToBuild(string scenePath)
        {
            var currentScenes = EditorBuildSettings.scenes;
            var sceneList = new System.Collections.Generic.List<EditorBuildSettingsScene>(currentScenes);

            // Check if already in build
            foreach (var s in sceneList)
            {
                if (s.path == scenePath) return;
            }

            sceneList.Add(new EditorBuildSettingsScene(scenePath, true));
            EditorBuildSettings.scenes = sceneList.ToArray();
            Debug.Log($"[SceneBuilder] Added '{scenePath}' to Build Settings.");
        }

        #endregion
    }
}
