# NOVA Annotation Codebook

**Version:** 1.0  
**Date:** February 2026  
**Tool:** NOVA v0.2.1 — Nursing Operational View of Actions

---

## Overview

This codebook defines the annotation schema used to label nursing simulation videos in NOVA. Annotations are organized into **three parallel layers** that are coded independently and simultaneously:

| Layer | Shortcut | Granularity | Description |
|-------|----------|-------------|-------------|
| **Behaviors** | `B` | Coarse, phase-level | High-level clinical phases of the encounter |
| **Actions** | `A` | Fine, event-level | Observable physical actions performed by the nurse |
| **Communication** | `C` | Continuous, turn-level | Who the nurse is verbally communicating with |

> [!IMPORTANT]
> Each layer is **independent**. An annotation on one layer does not affect another. Multiple actions can occur within a single behavior phase, and communication may span across behavior boundaries.

### Annotation Modes

- **Range Mode** (default): Mark a start time (`S`) and end time (`E`) to create a duration-based annotation.
- **Pin Mode**: Press `M` to stamp a single-frame event at the current time (configurable window in Settings → Pin Mode).

### General Coding Rules

1. **Code what you see.** Do not infer intent—only annotate observable actions.
2. **When in doubt, do not code.** It is better to leave an ambiguous segment unlabeled than to guess.
3. **Annotations should not overlap** within the same layer unless explicitly noted.
4. **Boundary precision:** Start the annotation when the action *begins* (first observable movement toward the action). End when the action *ends* (hands leave the object, body repositions away).
5. **Brief interruptions** (< 2 seconds): If the nurse briefly pauses an action and resumes, code it as one continuous annotation.

---

## Layer 1: Behaviors

Behaviors represent the **high-level clinical phases** of the nursing encounter. These are coarse, mutually exclusive segments that together should cover the full duration of the simulation. Use **Range Mode** for all behavior annotations.

| ID | Label | Color | Definition |
|----|-------|-------|------------|
| 1 | **Introduction / Identification** | 🔴 `#FF6B6B` | The nurse introduces themselves, identifies the patient, and establishes initial rapport. |
| 2 | **Assessment** | 🟢 `#4ECDC4` | The nurse gathers clinical information: checking vitals, reviewing history, performing physical examination. |
| 3 | **Med Administration** | 🔵 `#45B7D1` | The nurse prepares, calculates, verifies, and/or administers medication to the patient. |

### Behavior Coding Guidelines

- **Introduction/Identification** begins when the nurse first approaches and verbally greets the patient or family. It ends when the nurse transitions to a clinical task (e.g., reaching for equipment, opening the chart).
- **Assessment** covers all information-gathering activities: vital signs, wristband checks, chart review, and physical assessment. If the nurse returns to assessment after starting medication, code a new Assessment segment.
- **Med Administration** starts when the nurse begins any medication-related task: looking at the medication order, calculating dosage, preparing the med, or administering it. It ends when the nurse finishes the last medication-related action.

> [!NOTE]
> If the nurse switches back and forth between phases (e.g., assesses → administers → re-assesses), create separate segments for each phase rather than one long annotation.

### Boundary Decision Rules

| Scenario | Code as |
|----------|---------|
| Nurse greets patient while washing hands | **Introduction/Identification** (verbal greeting takes priority for phase) |
| Nurse checks wristband before greeting | **Introduction/Identification** (wristband check is part of patient identification) |
| Nurse reviews medication order on screen | **Med Administration** (medication-related chart review) |
| Nurse reviews vital signs on screen | **Assessment** (clinical data gathering) |
| Ambiguous transition between Assessment and Med Admin | End the previous phase when the nurse's **gaze and hands** shift to medication-related objects |

---

## Layer 2: Actions

Actions represent **discrete, observable physical behaviors** performed by the nurse. These are fine-grained and may overlap with each other when multiple actions happen simultaneously (e.g., talking while checking vitals). Use **Range Mode** for sustained actions and **Pin Mode** for momentary events.

| ID | Label | Color | Definition | Mode |
|----|-------|-------|------------|------|
| 1 | **Perform Hand Hygiene** | `#a29bfe` | Nurse uses hand sanitizer or washes hands at a sink. Starts when hands reach for sanitizer/soap; ends when rubbing stops. | Range |
| 2 | **Put on Gloves** | `#fd79a8` | Nurse retrieves and puts on disposable gloves. Starts at reaching for gloves; ends when both gloves are fully on. | Range |
| 3 | **Check Patient Wristband** | `#e17055` | Nurse visually inspects or scans the patient's wristband for identity verification. | Range/Pin |
| 4 | **Check Patient History Screen** | `#00cec9` | Nurse looks at and interacts with the electronic health record or patient history on a computer/tablet screen. Distinguished from vital signs screen by content (history, orders, notes vs. real-time vitals). | Range |
| 5 | **Examine Med Bottle** | `#6c5ce7` | Nurse picks up, reads, and/or inspects a medication bottle or package label. Includes the "three checks" of medication label verification. | Range |
| 6 | **Review Vital Signs Screen** | `#fdcb6e` | Nurse looks at the vital signs monitor screen displaying current or recent measurements (HR, BP, SpO2, etc.). | Range |
| 7 | **Assess Vital Signs (Palpate Wrist)** | `#e84393` | Nurse manually palpates the patient's radial pulse by touching the wrist. Starts when fingers contact the wrist; ends when hand is removed. | Range |
| 8 | **Auscultate Lung Sounds** | `#0984e3` | Nurse places stethoscope on the patient's **chest or back** to listen to lung/breath sounds. The stethoscope is positioned on the thorax (anterior, posterior, or lateral). | Range |
| 9 | **Measure Apical Pulse** | `#2d98da` | Nurse places stethoscope on the patient's **left chest (apex of heart)** to auscultate the heartbeat and count the apical pulse. Typically held in one position for 30–60 seconds. | Range |
| 10 | **Measure Temperature** | `#d63031` | Nurse uses a thermometer (oral, tympanic, temporal, etc.) to take the patient's temperature. | Range/Pin |
| 11 | **Measure Blood Pressure** | `#55a3ff` | Nurse initiates a blood pressure reading, either by pressing a button on the vital signs monitor or manually with a cuff. | Range/Pin |
| 12 | **Writing** | `#81ecec` | Nurse writes or documents on paper (not a screen). Includes any pen-to-paper activity: notes, calculations on paper, filling out forms. | Range |
| 13 | **Use Calculator** | `#fab1a0` | Nurse uses any calculator to compute medication dosage or other values. Includes both physical desk calculators and the calculator app on a phone. | Range |
| 14 | **Check Phone** | `#ffeaa7` | Nurse looks at or interacts with a mobile phone for **non-calculator purposes** (e.g., checking notifications, reading messages, looking something up). | Range/Pin |
| 15 | **Prepare Medication** | `#74b9ff` | Nurse prepares the medication for administration: drawing up liquid in a syringe, crushing a tablet, mixing a solution, or opening packaging. | Range |
| 16 | **Apply Medication to Patient** | `#a29bfe` | Nurse directly administers the prepared medication to the patient: oral delivery, injection, IV push, topical application, etc. | Range |

> [!NOTE]
> **Verbal introductions** (e.g., "Hi, I'm Nurse Smith") are not coded as an Action. They are captured by the **Behavior layer** (Introduction/Identification) and the **Communication layer** (Patient or Family).

### Action Coding Guidelines

#### Distinguishing Stethoscope Actions (9 vs. 10)

This is a common source of confusion. Use these rules:

| Cue | Code as |
|-----|---------|
| Stethoscope placed on **back** (posterior thorax) | **9 — Auscultate Lung Sounds** |
| Stethoscope placed on **front of chest, multiple positions** (moved around) | **9 — Auscultate Lung Sounds** |
| Stethoscope placed on **left chest near apex, single position, held 15+ seconds** | **10 — Measure Apical Pulse** |
| Cannot tell placement clearly | Code as **9** (lung sounds is more common) and flag for review |

#### Distinguishing Calculator vs. Phone (14 vs. 15)

| Cue | Code as |
|-----|---------|
| Nurse is tapping numbers on phone with calculator app visible | **14 — Use Calculator** |
| Nurse is using a physical desk/handheld calculator | **14 — Use Calculator** |
| Nurse is scrolling, reading, or swiping on phone (not calculator) | **15 — Check Phone** |
| Nurse picks up phone briefly but unclear purpose | **15 — Check Phone** |

#### Distinguishing Screen Actions (5 vs. 7)

| Cue | Code as |
|-----|---------|
| Nurse is looking at a screen showing **waveforms, numbers updating in real-time** (HR, SpO2) | **7 — Review vital signs screen** |
| Nurse is looking at a screen showing **text records, history, medication orders** | **5 — Check Patient History Screen** |
| Nurse clicks a button on the vitals monitor to **start BP measurement** | **12 — Measure blood pressure** (the action is initiating the measurement) |

#### Writing vs. Calculator (13 vs. 14)

| Cue | Code as |
|-----|---------|
| Pen on paper, writing words or numbers | **13 — Writing** |
| Using calculator and then writing result | Code **14** during calculator use, then **13** when writing begins |
| Doing arithmetic on paper without a calculator | **13 — Writing** |

---

## Layer 3: Communication

Communication annotations track **who the nurse is verbally interacting with** at any given time. These are continuous, turn-level segments. Use **Range Mode** for all communication annotations.

| ID | Label | Color | Definition |
|----|-------|-------|------------|
| 1 | **Patient** | 🔵 `#4285F4` | Nurse is speaking to or actively listening to the patient (simulated or standardized). |
| 2 | **Family** | 🟢 `#34A853` | Nurse is speaking to or actively listening to a family member (parent, caregiver, etc.). |
| 3 | **Provider** | 🟡 `#FBBC05` | Nurse is speaking to or actively listening to another healthcare provider (instructor, physician, fellow nurse, etc.). |

### Communication Coding Guidelines

- **Start** a communication annotation when the nurse begins speaking or clearly turns to listen to someone.
- **End** the annotation when the verbal exchange pauses for more than **3 seconds** or the nurse redirects attention to a different person or task.
- If the nurse speaks to the patient **and** family simultaneously (e.g., "Mom, I'm going to take Johnny's temperature now"), code as **Family** if the statement is directed at the family member, or **Patient** if directed at the patient. If truly both, code as whichever person the nurse makes **eye contact** with.
- **Silence during a procedure** (e.g., nurse is quietly taking vitals) should **not** be coded as communication, even if the patient or family is present.
- **Self-talk or thinking aloud** is not coded unless clearly directed at another person.

### Boundary Decision Rules

| Scenario | Code as |
|----------|---------|
| Nurse explains procedure to parent while touching patient | **Family** (verbal direction determines the label) |
| Nurse says "Can you squeeze my hand?" to patient | **Patient** |
| Nurse calls out to someone outside the room | **Provider** (unless clearly calling a family member) |
| Nurse on phone with pharmacy | **Provider** |
| Nurse and patient making small talk | **Patient** |
| Brief acknowledgment ("uh-huh") while focused on a task | Code only if part of an ongoing exchange; otherwise skip |

---

## Quick Reference Card

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Step back / forward one frame |
| `S` | Start range annotation |
| `E` | End range annotation |
| `M` | Pin annotation (Pin Mode only) |
| `Z` | Undo last annotation |

### Workflow

1. Load video(s) and set up modalities
2. Select the **layer** (Behaviors / Actions / Communication)
3. Select the **type** within that layer
4. Play the video and use `S`/`E` (Range) or `M` (Pin) to annotate
5. Repeat across all three layers
6. Export annotations when complete

---

*This codebook is a living document. Update as coding conventions evolve.*
