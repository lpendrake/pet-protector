# Pet Protector 

## The guardian spirit - AKA the player
The player is a non-physical entity, a spirit.

They're the guardian spirit of "the pet".

They can't physically interact with the world, but the pet can sense them and there is a rudimentary emotional connection between them.

The game is played by leading the pet around. It likes the spirit, trusts it, so it follows it around.

The spirit can really only see the world and decide where to go.

If the pet is hungry, the player should lead it to a food source. 

If it's thirsty, it needs water.

## So what is the pet? 

The pet is a bear like creature. It's strong, tough, can hibernate, can climb, is an omnivore.

## What's the point?

It is two-fold.

1. Look after the pet.
2. Explore the world.

## The world

The world is a procedurally generated world made up of tiles. 
It's a top down view of the world. The spirit can venture a few times from the pet, and then call it to them when they determine a direction.

### Is there danger?

Yes, there are fantastical versions of animals, and other dangers which we'll define as we go.

### What is interesting about the world?

There are ruins of an ancient civilization scattered around. They're all stone structures, and they're all empty. 

However, there are murals, telling partial stories of the past. 

These murals are the main way to learn about the world, and the story of the pet.

Interactions with the monsters are always to run away from them, or to befriend them.

This is a game about exploration, and discovery. Each creature they run into will have some unique way they react to the pet, the spirit and a way to befriend them.

It's impossible to fail in the game. There's no hp or anything like that. 

## UI / Presentation

The main screen is the world map in top-down view, fairly zoomed in. The player should have to work to remember where they are and where things were — no full minimap.

### Picture-in-Picture (PiP) Windows

The pet is not visible on the map directly. Instead, a **PiP window** sits in the corner showing a side-on view of the pet in its current environment. This window is always present and reflects what the pet is doing — sleeping, eating honey, hunting, wandering, etc.

The PiP serves three purposes:
1. **Emotional anchor** — the map is abstract tiles; the PiP is where the player *feels* something.
2. **Visual state display** — the pet's condition (hungry, tired, happy) is communicated through what we see it doing, reducing the need for stat bars and text overlays.
3. **Reinforces the spirit/pet separation** — the map is the spirit's detached, overhead view; the PiP is the pet's grounded, physical reality. Two perspectives, two windows.

When encountering a **creature**, a second PiP appears on the opposite side of the screen, framing the meeting — pet on one side, creature on the other, the world between them. The two PiP windows can react to each other during befriending interactions.

For **murals** and other showcase moments, a larger PiP (or an expanded view) takes over most of the screen, as if the spirit is focusing its attention. The map fades to the periphery.

### Exploration Helper

TBD — we need some kind of navigational aid to help the player orient themselves on the zoomed-in map without giving them a full minimap. Needs more thought.

## Progression

Each creature will, upon being befriended, gift the pet with a new ability. 

These abilities will help the pet survive in the world, and also help the player explore the world.

### Skills to be gained

- Climbing
- Swimming / Water Crossing (to cross rivers and deep water)
- Claws for breaking through supernatural thickets
- Eyes that can see through some obstacle that normally blocks progression
- Super jump to bypass large gaps.
- The ability to shrink to fit through small gaps.
- A superior sense of smell that can detect magical auras, allowing the pet to find crucial items.
- Courage to face things that used to scare it.

## New Mechanics

### Spirit Anchoring
The spirit is typically bound to the pet (Buddy). However, there are specific "Anchor Points" in the world (ancient pillars, magical groves, etc.) where the spirit can bind itself. While anchored to a point, the spirit can only venture a short distance from that point, but Buddy is free to roam (or stay) independently.

### Fear & Dragging
Buddy is not always brave. Certain environmental triggers or creatures can cause Fear.
- When **Scared**, Buddy will bolt in the opposite direction.
- If the spirit is currently anchored to Buddy, it is **dragged along** for the ride, forced to follow Buddy's panicked flight.
- Befriending certain creatures or gaining the "Courage" skill can mitigate this.

### Stale Fog of War
The world is only "live" where the spirit can see. 
- **Vision Range**: Current tiles within 3 units of the spirit update in real-time.
- **Fog of History**: Tiles previously visited but no longer in range remain visible (not black), but their state is "frozen" in time (grayed out) until the spirit returns. You won't see apples regrow, creatures move, or Buddy's position update in these stale areas.

## The gameplay loop

1. Explore the world
2. Find creatures
3. Befriend them
4. Get new abilities
5. Explore more
6. Find ruins
7. Learn about the world
8. Repeat

## Exanple Mural

A depiction of a tower, an eye wreathed in lightning at the top. Ape like creatures are seen at the base of the tower, on it's balconies.

The next scene is erroded and can't be seen, but the one after that shows the same tower, but a flog flood from it, and the apes flee the fog as it kills those it has touched.

## Example creatures

A magical wolf, flowing fur made of moonlight.

A bird who's eyes are black diamonds and who's feathers shimmer like oil on water.

A snake made of living wood, with glowing mushrooms growing on it's back.

