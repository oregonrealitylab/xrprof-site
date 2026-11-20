/* XR for Learning Decision Tree: the content.
   Source: "XR for Learning Decision Tree, For Informal Learning Contexts" (Daniel Pimentel).
   Everything a visitor reads lives in this file, so it can be edited without touching the code.

   HOW A STEP IS WRITTEN
     id: {
       phase: 1-4, label: "short name used on the one-page brief",
       q: "the question", help: "optional line under it",
       opts: [ { t: "answer", sub: "optional small print",
                 go: "id of the next step",
                 say: { tone: "ok" | "warn" | "stop", text: "advice shown after this answer",
                        brief: "short version for the one-pager (warn and stop only)",
                        change: "for stops: what would change the answer" },
                 set: { platform: "AR" }            // remembers something for later steps
               } ]
     }
   Lines marked FILLED IN were not in the deck (it had a blank, a placeholder, or no branch there).
   They are first drafts: please review them. */
(function () {
  var R = {   /* Resources, reused across steps. EDIT: names, links and one-line reasons. */
    seek:      { n: "Seek by iNaturalist", u: "https://www.inaturalist.org/pages/seek_app", d: "Often called the Shazam for nature: point the camera at an animal or plant to identify it and learn about it." },
    plantnet:  { n: "Pl@ntNet", u: "https://plantnet.org/en/", d: "Identifies plant species from a photo of a leaf, flower or bark." },                                   /* FILLED IN (deck: \"Plant ID App\") */
    lens:      { n: "Google Lens", u: "https://lens.google/", d: "Scan an object, sign or artwork and get information about what it is." },                             /* FILLED IN (deck: \"Example App\") */
    polycam:   { n: "Polycam", u: "https://poly.cam/", d: "Walk around an object or person with a phone to capture it as a 3D model." },                              /* FILLED IN (deck: \"Example App\") */
    scaniverse:{ n: "Scaniverse", u: "https://scaniverse.com/", d: "Free phone app for 3D scans, including Gaussian splats." },                                       /* FILLED IN */
    g3d:       { n: "Google Search: View in 3D", u: "https://support.google.com/websearch/answer/9817187", d: "Search some animals and objects on a phone and place them in your space at life size. The list is shorter than it used to be." },
    sketchfab: { n: "Sketchfab", u: "https://sketchfab.com/", d: "Large library of 3D models that can be viewed in AR from a phone. Downloads are moving to its sister site, Fab." },
    si3d:      { n: "Smithsonian 3D", u: "https://3d.si.edu/", d: "Scanned museum objects, fossils and artefacts to view and download." },                             /* FILLED IN */
    snaplens:  { n: "Snapchat Lenses", u: "https://www.snapchat.com/lens", d: "Thousands of ready-made AR filters, including educational ones, that open from a link or Snapcode." }, /* FILLED IN */
    tteffects: { n: "TikTok effects", u: "https://effecthouse.tiktok.com/", d: "AR effects learners may already use; search for a topic inside the app." },                  /* FILLED IN */
    stellarium:{ n: "Stellarium Mobile", u: "https://stellarium-labs.com/stellarium-mobile-plus/", d: "Hold a phone to the sky and see the stars and planets for your exact place and time." }, /* FILLED IN */
    peak:      { n: "PeakVisor", u: "https://peakvisor.com/", d: "Labels the mountains and landmarks in view based on where you are standing." },                      /* FILLED IN */
    lensstudio:{ n: "Lens Studio", u: "https://ar.snap.com/lens-studio", d: "Free tool for making AR lenses for Snapchat and for Snap's Spectacles and Specs AR glasses. Templates cover faces, bodies, image markers and the world." },
    effecthouse:{ n: "TikTok Effect House", u: "https://effecthouse.tiktok.com/", d: "Free tool for making AR effects for TikTok." },                                    /* FILLED IN (replaces Spark AR, which Meta shut down in January 2025) */
    artivive:  { n: "Artivive", u: "https://artivive.com/", d: "Upload an image and the video or 3D content it should trigger. No code." },
    mywebar:   { n: "MyWebAR", u: "https://mywebar.com/", d: "Build AR that opens in a phone's browser from a QR code. No app, no code." },
    zapworks:  { n: "Zapworks", u: "https://zap.works/", d: "Browser-based AR builder with image tracking and templates." },                                           /* FILLED IN */
    unity:     { n: "Unity Learn", u: "https://learn.unity.com/", d: "Free courses for the Unity engine, including AR Foundation for phones and XR for headsets." },
    ytvr:      { n: "YouTube 360 and VR", u: "https://vr.youtube.com/", d: "Free 360-degree videos of places, events and nature. Works in a headset or on a phone." },      /* FILLED IN */
    wander:    { n: "Wander", u: "https://www.meta.com/experiences/wander/2078376005587859/", d: "Paid app. Stand almost anywhere on Earth using street-level imagery, with facts about each place." },      /* FILLED IN */
    metaedu:   { n: "Meta Quest: Educational apps", u: "https://www.meta.com/experiences/section/854758534732051/", d: "The store's own list of learning apps. Filter by subject and check age ratings and captions." }, /* FILLED IN */
    metamr:    { n: "Meta Quest: Mixed reality apps", u: "https://www.meta.com/experiences/section/7552117818138723/", d: "The store's list of mixed reality titles for Quest 3 and 3S." },  /* FILLED IN */
    openbrush: { n: "Open Brush", u: "https://openbrush.app/", d: "Free, open-source 3D painting in VR." },                                                             /* FILLED IN */
    gravity:   { n: "Gravity Sketch", u: "https://www.gravitysketch.com/", d: "Sketch and model in 3D with your hands. Free for individuals." },                       /* FILLED IN */
    piano:     { n: "PianoVision", u: "https://www.meta.com/experiences/pianovision/5271074762922599/", d: "A model for skill practice in MR: guidance is overlaid on a real keyboard." },               /* FILLED IN */
    figmin:    { n: "Figmin XR", u: "https://www.figmin.com/", d: "Paid app for Quest and Vision Pro. Learners build, draw and place 3D content in the room around them, no code needed." },                     /* FILLED IN */
    jig:       { n: "JigSpace", u: "https://www.jig.space/", d: "Step-by-step 3D explanations of how things work, placed on a table. Runs on iPhone, iPad and Apple Vision Pro." },                              /* FILLED IN */
    shapes:    { n: "ShapesXR", u: "https://www.shapesxr.com/", d: "Lay out a VR or MR scene together in a headset, without code, to prototype an idea." },           /* FILLED IN */
    delightex: { n: "Delightex Edu", u: "https://www.delightex.com/edu", d: "Formerly CoSpaces Edu. Build simple 3D worlds in a browser, with block coding, and view them in VR or AR." }, /* FILLED IN */
    thinglink: { n: "ThingLink", u: "https://www.thinglink.com/", d: "Turn your own 360 photos into a clickable virtual tour." },                                       /* FILLED IN */
    realitycp: { n: "Reality Composer Pro", u: "https://developer.apple.com/augmented-reality/tools/", d: "Apple's free tool for composing 3D scenes for Vision Pro, iPhone and iPad." }, /* FILLED IN */
    /* ---- Added November 2026 after a fresh look at what is current. All FILLED IN: please review. ---- */
    lenslist:  { n: "Lenslist", u: "https://lenslist.co/", d: "A curated directory of AR filters across Snapchat and TikTok, with monthly best-of lists. Search it for a lens on your topic." },
    easylens:  { n: "Easy Lens by Snap", u: "https://easylens.snapchat.com/", d: "Describe a Snapchat lens in plain words and it is built for you. Works on the web, iPhone and Android. Users must be 13 or older." },
    gac:       { n: "Google Arts & Culture: AR", u: "https://artsandculture.google.com/project/ar", d: "Hang life-size artworks on your wall, walk through a Pocket Gallery, and place 3D animals and objects in your space." },
    merge:     { n: "Merge EDU and Merge Cube", u: "https://mergeedu.com/", d: "Learners hold a foam cube that turns into a 3D object on screen: a heart, a fossil, a planet. Free samples; the full library is a subscription." },
    assemblr:  { n: "Assemblr EDU", u: "https://edu.assemblrworld.com/", d: "Thousands of ready-made 3D and AR lesson objects, plus a drag-and-drop editor for making your own." },
    hyperscape:{ n: "Meta Horizon Hyperscape (beta)", u: "https://www.meta.com/help/quest/1088536553019177/", d: "Scan a real room with a Quest 3 or 3S and revisit it as a photorealistic place, shared by link. Only adults 18 and over can capture." },
    marble:    { n: "Marble by World Labs", u: "https://marble.worldlabs.ai/", d: "Generates a 3D world you can walk through from a text prompt, a photo or a 360 panorama. Viewable in VR." },
    gmapsxr:   { n: "Google Maps on Android XR", u: "https://blog.google/products/android/samsung-galaxy-xr", d: "On Samsung's Galaxy XR headset: explore cities and landmarks in 3D with Immersive View." },
    horizon:   { n: "Meta Horizon (mobile app)", u: "https://horizon.meta.com/", d: "User-made social worlds. Meta made it mobile-first in 2026: it left the Quest store and only some existing worlds still open in VR, so test any world on your own devices first." },
    harvard:   { n: "Learning in the Metaverse: A Guide for Practitioners", u: "https://nextlevellab.gse.harvard.edu/files/2023/02/IntroductionLearningMetaverse-April2022-MeridianTreehouse.pdf", d: "Evidence-based strategies for educators, museum designers and decision makers." }, /* FILLED IN (deck: \"please see ____\") */
    georgian:  { n: "XR best practices report (Georgian College)", u: "https://fsc-ccf.ca/wp-content/uploads/2024/07/GeorgianCollegeDigitalTransformationBestPracticesv6.pdf", d: "Practical guidance on onboarding, safety, hygiene and when to avoid VR." } /* FILLED IN */
  };

  var OK_OUTCOME = { tone: "ok", text: "Research suggests XR can help achieve these outcomes." };
  var LARGE_AR = "It may be difficult to facilitate MR or VR for a large group without help with onboarding and troubleshooting, and VR and MR are best used in short sessions. AR is generally your best bet for large groups, since learners can use their own smartphones.";

  var T = {
    /* ============================== PHASE 1: Should I use XR? ============================== */
    p1_outcome: { phase: 1, label: "Learning outcome", q: "What best represents your primary learning outcome?", opts: [
      { t: "Procedural", sub: "Doing", go: "p1_age", say: OK_OUTCOME },
      { t: "Understanding", sub: "Conceptualizing", go: "p1_age", say: OK_OUTCOME },
      { t: "Memorization", sub: "Remembering", go: "end_no", say: { tone: "stop",
        text: "XR can work against retention due to cognitive overload. If you are trying to convey specific information, traditional teaching may be more effective.",
        brief: "The goal is memorization, where XR's cognitive load can work against retention.",
        change: "Find the part of your lesson that is about doing or understanding, and consider XR for that part only." } }   /* change: FILLED IN (all of them) */
    ] },
    p1_age: { phase: 1, label: "Learners' age", q: "What age are your learners?", opts: [
      { t: "13 and over", go: "p1_env", say: { tone: "ok", text: "Great! The recommended age for XR use is 13+ regardless of modality." } },
      { t: "Under 13", go: "end_no", say: { tone: "stop",
        text: "Science has yet to understand the effects of XR on developing brains. It is not recommended to allow children under 13 to use XR. Additionally, hardware usually does not fit the heads of young children.",
        brief: "Learners are under 13, below the recommended age for XR use.",
        change: "Keep the device in an adult's hands: show a 3D model or 360 video on a shared screen instead of putting XR on the children." } }
    ] },
    p1_env: { phase: 1, label: "Setting", q: "What best describes the learning environment?", opts: [
      { t: "Museum", sub: "or similar", go: "p1_decider", set: { env: "museum" } },
      { t: "Classroom", sub: "virtual or face-to-face", go: "p1_count", set: { env: "classroom" } },
      { t: "Learner's home", go: "p1_access", set: { env: "home" }, say: { tone: "warn",
        text: "Ensure the environment is conducive to XR learning. If there is not enough space, or there are too many distractions, you may reconsider.",
        brief: "Check each home has enough clear space and few distractions." } },
      { t: "Outdoors", go: "p1_outdoor", set: { env: "outdoors" } }
    ] },
    p1_decider: { phase: 1, label: "Decision maker", q: "Are you a decision maker for the center?", opts: [
      { t: "Yes", go: "p1_count" },
      { t: "No", go: "p1_count", say: { tone: "warn", text: "Pause. Make sure to involve the center's staff when planning and creating your XR learning experience.",
        brief: "Involve the center's staff in planning before you build anything." } }
    ] },
    p1_outdoor: { phase: 1, label: "Outdoor setting", q: "What best describes the learning experience?", opts: [
      { t: "Stationary, in a covered area", go: "p1_count", say: { tone: "ok", text: "This is similar to indoor conditions." } },
      { t: "In nature", go: "p1_active" }
    ] },
    p1_active: { phase: 1, label: "Activity level", q: "How active will learners be outside?", opts: [
      { t: "A little", sub: "walking, sitting", go: "p1_count", say: { tone: "warn", text: "XR and water don't mix. If the risk of students or equipment falling into water is minimal, continue.",
        brief: "Keep learners and equipment well away from water." } },
      { t: "Very active", go: "end_no", say: { tone: "stop",
        text: "Safe and effective XR use often requires a controlled environment that is safe for walking. XR use that involves active movement may be dangerous and cause injury.",
        brief: "Learners will be very active outdoors, where XR use can cause injury.",
        change: "Split the session: do the active part without devices, then use XR at a stationary stop on safe, level ground." } }
    ] },
    p1_count: { phase: 1, label: "Group size", q: "How many students are involved?", opts: [
      { t: "12 or more", go: "p1_solo", set: { big: true } },
      { t: "Fewer than 12", go: "p1_where", set: { big: false } }
    ] },
    p1_solo: { phase: 1, label: "Facilitation", q: "Is it just you facilitating?", opts: [
      { t: "Yes, just me", go: "end_no", say: { tone: "stop", text: "Facilitating XR experiences is difficult for large groups, especially alone.",
        brief: "One facilitator for 12 or more learners is too few for XR.",
        change: "Recruit co-facilitators, or run XR as one station that small groups rotate through." } },
      { t: "No, I have a team", go: "p1_where", set: { solo: false }, say: { tone: "warn", text: "Make sure your team knows about XR onboarding. More on this in the next phase.",
        brief: "Train every facilitator in XR onboarding before the session." } }
    ] },
    p1_where: { phase: 1, label: "Attendance", q: "Are your students in-person or remote?", opts: [
      { t: "In-person", go: "p1_access" },
      { t: "Remote", go: "p1_access", say: { tone: "warn",
        text: "Continue with caution. Depending on what kind of content they will experience, the logistics of integrating it into the lesson plan may be difficult.",
        brief: "Remote delivery makes logistics harder: test the full flow on learners' own setups." } }
    ] },
    p1_access: { phase: 1, label: "Equal access", q: "Do your learners have equal access to what XR requires?", help: "For example internet, hardware and space.", opts: [
      { t: "Yes", go: "p1_time" },
      { t: "No", go: "end_no", say: { tone: "stop", text: "You're not ready to equitably deploy XR for learning at the moment.",
        brief: "Learners do not have equal access to the internet, hardware or space XR needs.",
        change: "Close the gap first: loaner devices, an on-site session with shared equipment, or a version that works on any phone." } }
    ] },
    p1_time: { phase: 1, label: "Time available", q: "How much time do you have allocated to the activity in total?", opts: [
      { t: "Under 20 minutes", go: "end_no", say: { tone: "stop", text: "Onboarding for XR experiences requires adequate time. Consider low-tech alternatives that fit your window of time.",
        brief: "Under 20 minutes leaves no room for XR onboarding.",
        change: "Find a window of 30 minutes or more, or split the activity across two sessions." } },
      { t: "20 to 60 minutes", go: "p1_done", say: { tone: "warn",
        text: "This time frame may work depending on many factors, such as onboarding and hardware availability. Proceed with caution. Allotting time after the experience to reflect is incredibly important.",
        brief: "Time is tight: budget for onboarding first and reflection after." } },
      { t: "60+ minutes", sub: "or no strict limit", go: "p1_done" }
    ] },
    p1_done: { phase: 1, info: true, tone: "ok", title: "XR may be a justifiable learning tool",
      text: "Based on your specific situation, XR may be a justifiable learning tool! Next, let's determine which XR platform best suits your needs.", go: "p2_guided", cta: "Proceed to Phase 2" },

    /* ========================= PHASE 2: What XR platform should I use? ========================= */
    p2_guided: { phase: 2, label: "Guidance", q: "Are learners guided by you or your team, or is learning self-directed?", opts: [
      { t: "Self-directed", go: "p2_devices" },
      { t: "Guided by an educator", go: "p2_count" }
    ] },
    p2_devices: { phase: 2, label: "Devices", q: "Which of the following do your learners have access to?", opts: [
      { t: "Smartphone only", go: "p2_done", set: { platform: "AR" }, say: { tone: "warn",
        text: "Based on resource limitations, MR and VR are unlikely to be used effectively. AR may be your best bet, but this depends on other factors like subject matter.",
        brief: "With phones only, MR and VR are off the table for now." } },
      { t: "Smartphone plus an MR or VR headset", go: "p2_long" }
    ] },
    /* The deck asks group size and facilitation again here with finer bands. FILLED IN: answers already given in
       Phase 1 are carried over (see "auto"), so nobody is asked the same thing twice. */
    p2_count: { phase: 2, label: "Learners per session", q: "How many learners are involved?",
      auto: function (c) { return c.big === true ? 2 : null; },
      opts: [
        { t: "1 to 5", go: "p2_long", hide: function (c) { return c.big === true; }, say: { tone: "ok", text: "Small groups of learners can benefit from all XR platforms." } },
        { t: "6 to 12", go: "p2_solo", set: { mid: true }, say: { tone: "warn",
          text: "Rule out MR: hardware is scarce and expensive, and it is difficult to facilitate for a group this size. VR may be possible if you have resources for hardware, onboarding and troubleshooting. AR is your best bet, since learners can use their smartphones.",
          brief: "At 6 to 12 learners, MR is ruled out and VR needs real support resources." } },
        { t: "More than 12", go: "p2_solo", set: { big: true }, hide: function (c) { return c.big === false; } }
      ] },
    p2_solo: { phase: 2, label: "Facilitation", q: "Is it only you facilitating the learning experience?",
      auto: function (c) { return c.solo === false ? 1 : null; },
      opts: [
        { t: "Yes, only me", go: "p2_done", set: { platform: "AR" }, say: { tone: "warn", text: LARGE_AR, brief: "Facilitating alone: choose AR on learners' own phones over headsets." } },
        { t: "No, I have help", go: "p2_long" }
      ] },
    p2_long: { phase: 2, label: "Time in XR", q: "How long do you envision learners engaging with XR?", opts: [
      { t: "Under 30 minutes", go: "p2_dice" },
      { t: "30 minutes or more", go: "p2_breaks" }
    ] },
    p2_breaks: { phase: 2, label: "Breaks", q: "Can learners take a 15-minute break every 30 minutes?", opts: [
      { t: "Yes", go: "p2_dice", say: { tone: "ok", text: "Good. 15-minute breaks after extended VR or MR use help with eye strain.", brief: "" } },
      { t: "No", go: "p2_done", set: { platform: "AR" }, say: { tone: "warn",
        text: "15-minute breaks after extended VR or MR use help with eye strain. Without them, long headset sessions are not recommended. " + LARGE_AR,
        brief: "No room for breaks: avoid long headset sessions and use AR." } }
    ] },
    p2_dice: { phase: 2, label: "Hard to do in real life?", q: "Is what you want learners to do in XR considered Dangerous, Impossible, Counterproductive or Expensive to do in real life?", opts: [
      { t: "Yes", go: "p2_dis" },
      { t: "No", go: "p2_done", set: { platform: "AR", augment: true }, say: { tone: "warn",
        text: "There is no need to use XR to replace experiences otherwise available to learners in the wild. AR may be able to augment activities learners already do in real life.",
        brief: "Do not replace what learners can do for real: use AR only to add to it." } }
    ] },
    p2_dis: { phase: 2, label: "Physical disability", q: "Do any of your learners have a physical disability?", opts: [
      { t: "No", go: "p2_transport" },
      { t: "Yes", go: "p2_distype" }
    ] },
    p2_distype: { phase: 2, label: "Accessibility need", q: "What best describes your learner's disability?", opts: [
      { t: "Visual impairment", go: "p2_transport", say: { tone: "warn",
        text: "While XR is largely a visual medium, legally blind users can also experience immersion in virtual spaces through spatial audio, and there may be content that meets these learners' needs. Users with visual impairments can also use assistive settings; for example, there are VR lens inserts for users who wear glasses. Proceed and keep them in mind.",
        brief: "Visual impairment: look for spatial audio, assistive settings and prescription lens inserts." } },
      { t: "Hearing impairment", go: "p2_transport", say: { tone: "warn",
        text: "XR relies heavily on audio cues. However, partial or complete deafness does not limit a student's ability to gain value from XR experiences. As you progress, pay close attention to the accessibility features of the content you're considering. Does it provide closed captioning? Is speech-to-text available for social interactions?",
        brief: "Hearing impairment: choose content with captions and speech-to-text." } },
      { t: "Motor impairment", go: "p2_transport", say: { tone: "warn",
        text: "Depending on the type of disability and its severity, your learner may or may not be able to use commercially available XR content. For example, users unable to use their hands may still be able to engage in VR using speech or gaze-based interactions, whereas mobile AR, which requires pointing a smartphone, may be difficult without assistance. Note the needs of your learners and proceed.",
        brief: "Motor impairment: check for voice or gaze input, and plan assistance for handheld AR." } }
    ] },
    p2_transport: { phase: 2, label: "Transport learners?", q: "Do you want to transport learners to a different environment?", opts: [
      { t: "Yes", go: "p2_done", set: { platform: "VR" }, say: { tone: "ok",
        text: "While AR and MR transform the physical space, VR transports users to other environments. VR seems like your best bet." } },
      { t: "No", sub: "I want them grounded in the physical space", go: "p2_do" }
    ] },
    p2_do: { phase: 2, label: "Learner activity", q: "What best describes what you want learners to do?", opts: [
      { t: "Create and/or interact with virtual content in their space", go: "p2_done", set: { platform: "MR" }, hide: function (c) { return !!c.mid; },
        say: { tone: "ok", text: "Generally, MR is great for allowing users to create and interact with virtual content in their environment in a realistic way. MR seems like your best bet." } },
      /* FILLED IN: the deck rules MR out for 6 to 12 learners but could still land on MR here. */
      { t: "Create and/or interact with virtual content in their space", go: "p2_done", set: { platform: "AR", wantsMR: true }, hide: function (c) { return !c.mid; },
        say: { tone: "warn", text: "MR is the natural fit for creating and interacting with virtual content, but it was ruled out for a group of 6 to 12. AR is the practical choice. If you can borrow a headset or two, consider MR as a station for rotating groups of up to five.",
          brief: "MR fits the activity but not the group size: use AR, or MR as a small rotating station." } },
      { t: "Observe and review virtual content in their space", go: "p2_done", set: { platform: "AR" },
        say: { tone: "ok", text: "Generally, AR is great for more passive experiences where learners see content overlaid onto their physical world and its objects. AR seems like your best bet." } }
    ] },
    p2_done: { phase: 2, info: true, tone: "ok", platformCard: true, go: function (c) { return c.platform === "VR" ? "p3_vr_do" : c.platform === "MR" ? "p3_mr_do" : "p3_ar_scan"; }, cta: "Proceed to Phase 3" },

    /* =========================== PHASE 3: What XR content can I use? =========================== */
    p3_ar_scan: { phase: 3, label: "Scan real things?", q: "Do you want learners to scan physical things to learn about them?", opts: [
      { t: "Yes", go: "p3_ar_what" },
      { t: "No", go: "p3_ar_do" }
    ] },
    p3_ar_what: { phase: 3, label: "What they scan", q: "What kind of things will they be scanning?", opts: [
      { t: "Living things", go: "p3_ar_living" },
      { t: "Objects", go: "p3_ar_model" }
    ] },
    p3_ar_living: { phase: 3, label: "Living things", q: "What kind of living things?", opts: [
      { t: "Animals", go: "p3_meet", set: { need: "AR that identifies animals", res: ["seek", "lens"] }, say: { tone: "warn",
        text: "Proceed with caution when dealing with live animals. Consider using AR to let learners scan images of animals to trigger text or narrative descriptions instead.",
        brief: "Be careful around live animals: scanning pictures of them is a safer option." } },
      { t: "Plants", go: "p3_meet", set: { need: "AR that identifies plants", res: ["plantnet", "seek"] }, say: { tone: "ok",
        text: "AR is great for identifying plant species. Be respectful when navigating natural environments during AR use." } }
    ] },
    p3_ar_model: { phase: 3, label: "Make a 3D model?", q: "Do you want to create a 3D model of the scan?", opts: [
      { t: "Yes", go: "p3_meet", set: { need: "Scanning objects into 3D models", res: ["polycam", "scaniverse"] } },
      { t: "No, just scan to present information", go: "p3_meet", set: { need: "Scanning objects to learn about them", res: ["lens", "seek"] } }
    ] },
    p3_ar_do: { phase: 3, label: "AR should", q: "What do you want the AR app to do?", opts: [
      { t: "Show 3D models", go: "p3_meet", set: { need: "Viewing 3D models at scale", res: ["gac", "merge", "sketchfab", "si3d", "g3d", "assemblr"] }, say: { tone: "ok",
        text: "AR is great for viewing 3D models at scale! Libraries like Sketchfab and Smithsonian 3D have models you can open on a smartphone." } },
      { t: "Add a filter over the user or their environment", go: "p3_meet", set: { need: "AR filters", res: ["lenslist", "snaplens", "easylens", "tteffects"] }, say: { tone: "ok",
        text: "You may want to use AR filters that alter the way users see themselves and others." } },
      { t: "Show things based on the learner's location", go: "p3_meet", set: { need: "Location-based AR", res: ["stellarium", "peak", "lens"] }, say: { tone: "ok",
        text: "Location-based AR may help your learners get facts based on where they are." } }
    ] },
    /* FILLED IN: the deck has "I need MR content" and "I need VR content" boxes with nothing under them. */
    p3_mr_do: { phase: 3, label: "MR should", q: "What should MR let your learners do in their space?", opts: [
      { t: "Build, draw or arrange virtual things", go: "p3_meet", set: { need: "Creating in mixed reality", res: ["figmin", "shapes", "metamr"] } },
      { t: "Practise a skill on or around real objects", go: "p3_meet", set: { need: "Skill practice in mixed reality", res: ["piano", "metamr", "metaedu"] } },
      { t: "Examine 3D models together around a table", go: "p3_meet", set: { need: "Shared 3D models in mixed reality", res: ["jig", "metamr", "sketchfab"] } }
    ] },
    p3_vr_do: { phase: 3, label: "VR should", q: "Where should VR take your learners?", opts: [
      { t: "To real places they cannot visit", sub: "virtual field trips", go: "p3_meet", set: { need: "Virtual field trips", res: ["ytvr", "wander", "hyperscape", "gmapsxr", "metaedu"] } },
      { t: "Into a simulation to practise a procedure", go: "p3_meet", set: { need: "Practice simulations in VR", res: ["metaedu", "ytvr"] }, say: { tone: "warn",
        text: "Simulations are specific to a field, so search the store for your subject and try the app yourself first. Prefer apps where learners teleport instead of gliding, which reduces motion sickness.",
        brief: "Prefer VR apps that use teleporting over smooth movement to limit motion sickness." } },
      { t: "Inside a concept or system", sub: "the body, space, a molecule", go: "p3_meet", set: { need: "Concept exploration in VR", res: ["metaedu", "ytvr", "marble"] } },
      { t: "Into a blank space to create", go: "p3_meet", set: { need: "Creating in VR", res: ["openbrush", "gravity", "delightex", "marble", "horizon"] } }
    ] },
    p3_meet: { phase: 3, label: "Existing content fits?", suggest: true, q: "Do any of the suggestions meet your needs?", opts: [
      { t: "Yes!", go: "end_content" },
      { t: "No", go: "p4_regular", say: { tone: "ok", text: "It looks like your idea is unique! You may need to create your own XR experience. Phase 4 shows how you can get started." } }
    ] },

    /* ====================== PHASE 4: What can I use to create my own content? ====================== */
    /* The deck draws this phase for AR only. FILLED IN: the same questions are reused for MR and VR, with
       tools for each platform in the "build" lists further down. */
    p4_regular: { phase: 4, label: "Long-term use?", q: "Will learners be using this experience regularly over a long period of time?", opts: [
      { t: "No", go: function (c) { return c.platform === "AR" ? "p4_social" : "end_build"; }, set: { build: "nocode" }, say: { tone: "ok",
        text: "No programming needed. For one-off, single-use experiences, it may be best not to build your own app and instead use existing platforms for creating short XR experiences." } },
      { t: "Yes", go: "p4_budget", say: { tone: "ok", text: "Your learners may benefit from a standalone application built for their continued use." } }
    ] },
    p4_social: { phase: 4, label: "Delivery", q: "Do you want learners to use the AR content through existing social applications?", opts: [
      { t: "Yes", go: "end_build", set: { build: "social" } },
      { t: "No", go: "end_build", set: { build: "nocode" } }
    ] },
    p4_budget: { phase: 4, label: "Budget", q: "Do you have a budget for a programmer, 3D modeler and animator?", opts: [
      { t: "Yes", go: "end_build", set: { build: "hire" } },
      { t: "No", go: "p4_skill" }
    ] },
    p4_skill: { phase: 4, label: "Time and know-how", q: "Do you have the time and know-how to develop applications yourself?", opts: [
      { t: "Yes", go: "end_build", set: { build: "diy" } },
      { t: "No", go: "end_build", set: { build: "none" } }
    ] },

    end_no: { end: "no" }, end_content: { end: "content" }, end_build: { end: "build" }
  };

  /* What Phase 4 recommends, by route and platform. EDIT freely. */
  var BUILD = {
    social: { title: "Make a lens or effect for an app learners already have",
      text: "Lens Studio lets you create AR content for Snapchat. TikTok's Effect House does the same for TikTok. If you are new to this, start with Easy Lens, which builds a Snapchat lens from a written description. Meta closed Spark AR, its tool for Instagram and Facebook filters, in January 2025.",
      AR: ["easylens", "lensstudio", "effecthouse"] },
    nocode: { title: "Use a no-code platform",
      text: "For a one-off experience, build on a platform made for short XR experiences instead of making your own app.",
      AR: ["assemblr", "mywebar", "artivive", "zapworks"], MR: ["figmin", "shapes", "lensstudio"], VR: ["delightex", "marble", "thinglink", "hyperscape", "shapes"] },
    hire: { title: "Hire an XR developer",
      text: "Depending on the scope of your project, the funding required can vary significantly. Write a one-page description of what learners do, on which device and for how long, then ask two or three freelancers or small studios for estimates so you can compare. Prototype the idea without code first so everyone is quoting on the same thing.",   /* second and third sentences FILLED IN */
      AR: ["mywebar", "lensstudio"], MR: ["shapes"], VR: ["shapes"] },
    diy: { title: "Build it yourself with a game engine",
      text: "Unity is a game engine that can be used to build AR, MR and VR experiences. Start with a small prototype of the single most important interaction.",
      AR: ["unity", "lensstudio"], MR: ["unity", "lensstudio", "realitycp"], VR: ["unity", "delightex"] },
    none: { title: "Out of reach for now, but there are routes",
      text: "Unfortunately, an XR experience to meet your needs may be out of reach at the moment without funding or time to build your own content. One solution may be to apply for grants: look at funders of informal learning, museums and libraries, at local arts and humanities councils, and at community grants from technology companies. Another may be to seek pro bono development: university XR labs, student capstone courses and local XR meetups often look for real projects.",   /* examples FILLED IN (deck: blanks) */
      AR: ["mywebar", "artivive"], MR: ["figmin"], VR: ["delightex", "thinglink"] }
  };

  /* Shown when Phase 1 ends with "not the best option". FILLED IN. */
  var ALTERNATIVES = [
    "A 360 video or 3D model on a shared screen, with you as the guide",
    "Physical models, specimens or hands-on stations",
    "Role play or a walk-through of the real place, followed by discussion"
  ];
  var PLATFORMS = {
    AR: { name: "Augmented reality", line: "Digital content overlaid on the real world, usually through a smartphone." },
    MR: { name: "Mixed reality", line: "Virtual objects that sit in, and respond to, the learner's real space through a headset." },
    VR: { name: "Virtual reality", line: "A headset that replaces the surroundings and transports the learner somewhere else." }
  };
  var PHASES = ["", "Should I use XR?", "What XR platform should I use?", "What XR content can I use?", "What can I use to create my own content?"];
  var PRACTICE = ["harvard", "georgian"];

  window.XRTREE = { T: T, R: R, BUILD: BUILD, ALTERNATIVES: ALTERNATIVES, PLATFORMS: PLATFORMS, PHASES: PHASES, PRACTICE: PRACTICE, START: "p1_outcome" };
})();
