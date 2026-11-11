"""
Business Logic Service for TR STUDIO Step 3 — Professional AI Character Creation Studio.
Enforces strict user/project ownership isolation across all character, asset, expression,
pose, outfit, generation job, and story integration operations.
"""

import copy
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import (
    AppException,
    ForbiddenException,
    NotFoundException,
)
from app.core.logging import logger
from app.models.character import (
    Character,
    CharacterAsset,
    CharacterExpression,
    CharacterGenerationJob,
    CharacterOutfit,
    CharacterPose,
)
from app.models.project import Project, ProjectStatus
from app.models.story import Story
from app.models.user import User
from app.repositories.character_repository import CharacterRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.story_repository import StoryRepository
from app.schemas.character import (
    CharacterAppearanceAttributes,
    CharacterAssetResponse,
    CharacterAssetUpdateRequest,
    CharacterBibleData,
    CharacterCreateRequest,
    CharacterExpressionCreateRequest,
    CharacterExpressionResponse,
    CharacterExpressionUpdateRequest,
    CharacterExtendedMetadata,
    CharacterGenerateExpressionRequest,
    CharacterGenerateImageRequest,
    CharacterGenerateOutfitRequest,
    CharacterGeneratePoseRequest,
    CharacterGenerateSheetRequest,
    CharacterGenerationJobResponse,
    CharacterGenerationResultResponse,
    CharacterOutfitCreateRequest,
    CharacterOutfitResponse,
    CharacterOutfitUpdateRequest,
    CharacterPoseCreateRequest,
    CharacterPoseResponse,
    CharacterPoseUpdateRequest,
    CharacterPromptPreviewRequest,
    CharacterPromptPreviewResponse,
    CharacterRelationshipEntry,
    CharacterResponse,
    CharacterStorySyncRequest,
    CharacterSummaryResponse,
    CharacterUpdateRequest,
    CharacterVariationRequest,
    ImageProviderStatusResponse,
)
from app.schemas.story import CharacterRelationshipData, StoryCharacterData
from app.services.character_prompt_builder import CharacterPromptBuilder
from app.services.image_provider import (
    GeneratedImageArtifact,
    ReferenceImageInput,
    get_ai_image_provider,
    get_image_provider_status,
)
from app.services.storage_service import (
    get_storage_backend,
    validate_and_inspect_image_bytes,
)


class CharacterService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CharacterRepository(db)
        self.project_repo = ProjectRepository(db)
        self.story_repo = StoryRepository(db)
        self.storage = get_storage_backend()

    # ------------------------------------------------------------------
    # Ownership & Authorization Helpers
    # ------------------------------------------------------------------

    def _ensure_owned_project(
        self,
        user: User,
        project_id: Optional[uuid.UUID],
        default_title: str = "Character Studio Project",
    ) -> Project:
        if project_id:
            project = self.project_repo.get_by_id(project_id)
            if not project:
                raise NotFoundException("Project not found.")
            if project.owner_id != user.id:
                logger.warning(
                    "Cross-user project access blocked for character studio: user=%s project=%s",
                    user.id,
                    project_id,
                )
                raise ForbiddenException("You do not have permission to access this project.")
            return project

        # Reuse user's most recent project or create a default project
        existing = self.project_repo.list_by_owner(user.id)
        if existing:
            return existing[0]

        new_project = Project(
            owner_id=user.id,
            title=default_title[:200],
            description="Created automatically for TR STUDIO Character Creation Studio.",
            status=ProjectStatus.IN_PROGRESS.value,
        )
        self.db.add(new_project)
        self.db.commit()
        self.db.refresh(new_project)
        return new_project

    def _get_owned_character(self, user: User, character_id: uuid.UUID) -> Character:
        character = self.repo.get_by_id(character_id)
        if not character:
            raise NotFoundException("Character not found.")
        if character.owner_id != user.id:
            logger.warning(
                "Cross-user character access blocked: user=%s character=%s owner=%s",
                user.id,
                character_id,
                character.owner_id,
            )
            raise ForbiddenException("You do not have permission to access this character.")
        return character

    def _get_owned_story(self, user: User, story_id: uuid.UUID) -> Story:
        story = self.story_repo.get_by_id(story_id)
        if not story:
            raise NotFoundException("Story not found.")
        if story.owner_id != user.id:
            raise ForbiddenException("You do not have permission to access this story.")
        return story

    # ------------------------------------------------------------------
    # Serialization Helpers
    # ------------------------------------------------------------------

    def _serialize_asset(
        self,
        asset: CharacterAsset,
        canonical_asset_id: Optional[uuid.UUID] = None,
    ) -> CharacterAssetResponse:
        return CharacterAssetResponse(
            id=asset.id,
            character_id=asset.character_id,
            owner_id=asset.owner_id,
            asset_type=asset.asset_type,
            file_reference=asset.file_reference,
            url=self.storage.build_signed_media_url(asset.id, download=False),
            download_url=self.storage.build_signed_media_url(asset.id, download=True),
            prompt=asset.prompt,
            provider=asset.provider,
            generation_status=asset.generation_status,
            is_canonical_reference=bool(
                canonical_asset_id and asset.id == canonical_asset_id
            ),
            metadata=dict(asset.asset_metadata or {}),
            created_at=asset.created_at,
        )

    def _serialize_expression(
        self, expr: CharacterExpression
    ) -> CharacterExpressionResponse:
        ref_url = (
            self.storage.build_signed_media_url(expr.asset_id, download=False)
            if expr.asset_id
            else None
        )
        return CharacterExpressionResponse(
            id=expr.id,
            character_id=expr.character_id,
            name=expr.name,
            description=expr.description,
            generation_status=expr.generation_status,
            asset_id=expr.asset_id,
            reference_image_url=ref_url,
            created_at=expr.created_at,
        )

    def _serialize_pose(self, pose: CharacterPose) -> CharacterPoseResponse:
        ref_url = (
            self.storage.build_signed_media_url(pose.asset_id, download=False)
            if pose.asset_id
            else None
        )
        return CharacterPoseResponse(
            id=pose.id,
            character_id=pose.character_id,
            name=pose.name,
            category=pose.category,
            description=pose.description,
            generation_status=pose.generation_status,
            asset_id=pose.asset_id,
            reference_image_url=ref_url,
            created_at=pose.created_at,
        )

    def _serialize_outfit(self, outfit: CharacterOutfit) -> CharacterOutfitResponse:
        ref_url = (
            self.storage.build_signed_media_url(outfit.asset_id, download=False)
            if outfit.asset_id
            else None
        )
        return CharacterOutfitResponse(
            id=outfit.id,
            character_id=outfit.character_id,
            name=outfit.name,
            description=outfit.description,
            color_palette=list(outfit.color_palette or []),
            accessories=list(outfit.accessories or []),
            generation_status=outfit.generation_status,
            asset_id=outfit.asset_id,
            reference_image_url=ref_url,
            is_default=outfit.is_default,
            created_at=outfit.created_at,
        )

    def _serialize_summary(self, character: Character) -> CharacterSummaryResponse:
        ext = CharacterPromptBuilder.extract_extended_metadata(character)
        canon_url = (
            self.storage.build_signed_media_url(
                character.canonical_reference_asset_id, download=False
            )
            if character.canonical_reference_asset_id
            else None
        )
        if not canon_url and character.assets:
            canon_url = self.storage.build_signed_media_url(
                character.assets[0].id, download=False
            )

        return CharacterSummaryResponse(
            id=character.id,
            owner_id=character.owner_id,
            project_id=character.project_id,
            story_id=character.story_id,
            name=character.name,
            nickname=character.nickname,
            role=character.role,
            species=character.species,
            category=ext.category or "Original Character",
            age_description=character.age_description,
            personality=list(character.personality or []),
            appearance_description=character.appearance_description,
            style=character.style,
            canonical_reference_asset_id=character.canonical_reference_asset_id,
            canonical_reference_url=canon_url,
            asset_count=len(character.assets or []),
            expression_count=len(character.expressions or []),
            pose_count=len(character.poses or []),
            outfit_count=len(character.outfits or []),
            created_at=character.created_at,
            updated_at=character.updated_at,
        )

    def _serialize_character(self, character: Character) -> CharacterResponse:
        ext = CharacterPromptBuilder.extract_extended_metadata(character)
        canon_id = character.canonical_reference_asset_id
        canon_url = (
            self.storage.build_signed_media_url(canon_id, download=False)
            if canon_id
            else None
        )
        return CharacterResponse(
            id=character.id,
            owner_id=character.owner_id,
            project_id=character.project_id,
            story_id=character.story_id,
            name=character.name,
            nickname=character.nickname,
            role=character.role,
            species=character.species,
            age_description=character.age_description,
            personality=list(character.personality or []),
            backstory=character.backstory,
            motivation=character.motivation,
            appearance_description=character.appearance_description,
            canonical_reference_asset_id=canon_id,
            canonical_reference_url=canon_url,
            style=character.style,
            metadata=ext,
            assets=[
                self._serialize_asset(a, canonical_asset_id=canon_id)
                for a in (character.assets or [])
            ],
            expressions=[
                self._serialize_expression(e) for e in (character.expressions or [])
            ],
            poses=[self._serialize_pose(p) for p in (character.poses or [])],
            outfits=[self._serialize_outfit(o) for o in (character.outfits or [])],
            generation_jobs=[
                CharacterGenerationJobResponse.model_validate(j)
                for j in (character.generation_jobs or [])
            ],
            created_at=character.created_at,
            updated_at=character.updated_at,
        )

    # ------------------------------------------------------------------
    # Provider Status & Prompt Preview
    # ------------------------------------------------------------------

    def get_image_ai_status(self) -> ImageProviderStatusResponse:
        return get_image_provider_status()

    def preview_prompt(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterPromptPreviewRequest,
    ) -> CharacterPromptPreviewResponse:
        character = self._get_owned_character(user, character_id)
        ext = CharacterPromptBuilder.extract_extended_metadata(character)
        bible = ext.character_bible
        prompt = CharacterPromptBuilder.build_prompt(
            character=character,
            generation_type=payload.generation_type,
            style_override=payload.style_override,
            camera_framing=payload.camera_framing,
            background=payload.background,
            expression_name=payload.expression_name,
            pose_name=payload.pose_name,
            outfit_name=payload.outfit_name,
            outfit_description=payload.outfit_description,
            user_instructions=payload.user_instructions,
        )
        ref_ids = list(bible.selected_reference_asset_ids or [])
        if (
            character.canonical_reference_asset_id
            and str(character.canonical_reference_asset_id) not in ref_ids
        ):
            ref_ids.insert(0, str(character.canonical_reference_asset_id))

        status_info = get_image_provider_status()
        return CharacterPromptPreviewResponse(
            character_id=character.id,
            generation_type=payload.generation_type,
            style=payload.style_override or character.style,
            prompt=prompt,
            used_canonical_bible=bool(
                bible.canonical_description and bible.canonical_description.strip()
            ),
            reference_asset_ids=ref_ids,
            consistency_note=status_info.consistency_disclaimer,
        )

    # ------------------------------------------------------------------
    # Character CRUD & Variations
    # ------------------------------------------------------------------

    def create_character(
        self,
        user: User,
        payload: CharacterCreateRequest,
    ) -> CharacterResponse:
        project = self._ensure_owned_project(
            user,
            payload.project_id,
            default_title=f"{payload.name} — Character Project",
        )
        story_id = payload.story_id
        if story_id:
            story = self._get_owned_story(user, story_id)
            if story.project_id != project.id:
                project = self._ensure_owned_project(user, story.project_id)

        appearance = payload.appearance or CharacterAppearanceAttributes()
        bible = payload.character_bible or CharacterBibleData(
            canonical_description=payload.appearance_description or "",
            color_palette=list(appearance.color_palette or []),
            clothing_details=appearance.clothing or "",
            accessories_details=appearance.accessories or "",
            style_description=payload.custom_style_description or f"{payload.style} character style",
        )
        if not bible.canonical_description and payload.appearance_description:
            bible.canonical_description = payload.appearance_description

        ext_meta = CharacterExtendedMetadata(
            gender_presentation=payload.gender_presentation or "",
            category=payload.category or "Protagonist",
            strengths=list(payload.strengths or []),
            weaknesses=list(payload.weaknesses or []),
            special_abilities=list(payload.special_abilities or []),
            relationships=list(payload.relationships or []),
            appearance=appearance,
            character_bible=bible,
            custom_style_description=payload.custom_style_description or "",
            story_character_id=payload.story_character_id,
        )

        character = Character(
            owner_id=user.id,
            project_id=project.id,
            story_id=story_id,
            name=payload.name.strip(),
            nickname=payload.nickname.strip() if payload.nickname else None,
            role=payload.role,
            species=payload.species,
            age_description=payload.age_description,
            personality=list(payload.personality or []),
            backstory=payload.backstory,
            motivation=payload.motivation,
            appearance_description=payload.appearance_description
            or bible.canonical_description,
            style=payload.style,
            character_metadata=ext_meta.model_dump(mode="json"),
        )
        self.db.add(character)
        self.db.flush()

        if payload.seed_default_presets:
            starter_expressions = [
                ("Neutral", "Calm, balanced baseline facial expression"),
                ("Happy", "Warm, genuine smile with bright eyes"),
                ("Sad", "Downcast eyes and melancholic expression"),
                ("Angry", "Furrowed brow and intense focused glare"),
                ("Surprised", "Wide eyes and parted lips in astonishment"),
                ("Determined", "Confident, heroic resolve"),
            ]
            for expr_name, expr_desc in starter_expressions:
                self.db.add(
                    CharacterExpression(
                        character_id=character.id,
                        name=expr_name,
                        description=expr_desc,
                        generation_status="draft",
                    )
                )

            starter_poses = [
                ("Standing Hero Pose", "Standing", "Balanced full-body standing silhouette"),
                ("Walking Forward", "Walking", "Natural mid-stride walking motion"),
                ("Action Ready Stance", "Fighting", "Dynamic action-ready stance"),
            ]
            for pose_name, pose_cat, pose_desc in starter_poses:
                self.db.add(
                    CharacterPose(
                        character_id=character.id,
                        name=pose_name,
                        category=pose_cat,
                        description=pose_desc,
                        generation_status="draft",
                    )
                )

            default_outfit_desc = (
                appearance.clothing
                or bible.clothing_details
                or f"Signature default attire for {character.name}"
            )
            self.db.add(
                CharacterOutfit(
                    character_id=character.id,
                    name="Signature Default Outfit",
                    description=default_outfit_desc,
                    color_palette=list(bible.color_palette or []),
                    accessories=[appearance.accessories] if appearance.accessories else [],
                    generation_status="draft",
                    is_default=True,
                )
            )

        self.db.commit()
        reloaded = self._get_owned_character(user, character.id)

        # If linked to a story on creation, sync into the story without duplicating
        if story_id:
            self.sync_character_to_story(
                user,
                reloaded.id,
                CharacterStorySyncRequest(story_id=story_id),
            )
            reloaded = self._get_owned_character(user, character.id)

        return self._serialize_character(reloaded)

    def list_characters(
        self,
        user: User,
        project_id: Optional[uuid.UUID] = None,
        story_id: Optional[uuid.UUID] = None,
        role: Optional[str] = None,
        style: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[CharacterSummaryResponse]:
        if project_id:
            self._ensure_owned_project(user, project_id)
        if story_id:
            self._get_owned_story(user, story_id)
        items = self.repo.list_for_owner(
            owner_id=user.id,
            project_id=project_id,
            story_id=story_id,
            role=role,
            style=style,
            search=search,
            skip=skip,
            limit=limit,
        )
        return [self._serialize_summary(ch) for ch in items]

    def get_character(self, user: User, character_id: uuid.UUID) -> CharacterResponse:
        character = self._get_owned_character(user, character_id)
        return self._serialize_character(character)

    def update_character(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterUpdateRequest,
    ) -> CharacterResponse:
        character = self._get_owned_character(user, character_id)
        ext = CharacterPromptBuilder.extract_extended_metadata(character)

        if payload.project_id is not None:
            proj = self._ensure_owned_project(user, payload.project_id)
            character.project_id = proj.id
        if payload.story_id is not None:
            story = self._get_owned_story(user, payload.story_id)
            character.story_id = story.id
        if payload.name is not None:
            character.name = payload.name.strip()
        if payload.nickname is not None:
            character.nickname = payload.nickname.strip() or None
        if payload.role is not None:
            character.role = payload.role
        if payload.species is not None:
            character.species = payload.species
        if payload.age_description is not None:
            character.age_description = payload.age_description
        if payload.personality is not None:
            character.personality = list(payload.personality)
        if payload.backstory is not None:
            character.backstory = payload.backstory
        if payload.motivation is not None:
            character.motivation = payload.motivation
        if payload.appearance_description is not None:
            character.appearance_description = payload.appearance_description
        if payload.style is not None:
            character.style = payload.style

        if payload.canonical_reference_asset_id is not None:
            asset = self.repo.get_asset_by_id(payload.canonical_reference_asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Selected reference asset does not belong to this character.")
            character.canonical_reference_asset_id = asset.id

        if payload.gender_presentation is not None:
            ext.gender_presentation = payload.gender_presentation
        if payload.category is not None:
            ext.category = payload.category
        if payload.strengths is not None:
            ext.strengths = list(payload.strengths)
        if payload.weaknesses is not None:
            ext.weaknesses = list(payload.weaknesses)
        if payload.special_abilities is not None:
            ext.special_abilities = list(payload.special_abilities)
        if payload.relationships is not None:
            ext.relationships = list(payload.relationships)
        if payload.appearance is not None:
            ext.appearance = payload.appearance
        if payload.character_bible is not None:
            ext.character_bible = payload.character_bible
        if payload.custom_style_description is not None:
            ext.custom_style_description = payload.custom_style_description

        character.character_metadata = ext.model_dump(mode="json")
        self.db.add(character)
        self.db.commit()

        # If linked to a story, keep the story's character description synchronized
        if character.story_id:
            try:
                self.sync_character_to_story(
                    user,
                    character.id,
                    CharacterStorySyncRequest(story_id=character.story_id),
                )
            except Exception as exc:
                logger.warning("Failed to auto-sync updated character to story: %s", exc)

        reloaded = self._get_owned_character(user, character.id)
        return self._serialize_character(reloaded)

    def delete_character(self, user: User, character_id: uuid.UUID) -> None:
        character = self._get_owned_character(user, character_id)
        # Clean up stored asset files
        for asset in list(character.assets or []):
            self.storage.delete_asset(asset.file_reference)
        self.db.delete(character)
        self.db.commit()

    def create_character_variation(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterVariationRequest,
    ) -> CharacterResponse:
        source = self._get_owned_character(user, character_id)
        ext = copy.deepcopy(CharacterPromptBuilder.extract_extended_metadata(source))
        ext.parent_character_id = str(source.id)
        ext.story_character_id = None
        if payload.variation_notes:
            ext.character_bible.identity_notes = (
                f"{ext.character_bible.identity_notes or ''} | Variation: {payload.variation_notes}".strip(" |")
            )

        variation_name = (
            payload.name.strip()
            if payload.name and payload.name.strip()
            else f"{source.name} (Variation)"
        )
        new_char = Character(
            owner_id=user.id,
            project_id=source.project_id,
            story_id=source.story_id,
            name=variation_name,
            nickname=source.nickname,
            role=source.role,
            species=source.species,
            age_description=source.age_description,
            personality=list(source.personality or []),
            backstory=source.backstory,
            motivation=source.motivation,
            appearance_description=source.appearance_description,
            style=payload.style or source.style,
            character_metadata=ext.model_dump(mode="json"),
        )
        self.db.add(new_char)
        self.db.commit()
        reloaded = self._get_owned_character(user, new_char.id)
        return self._serialize_character(reloaded)

    # ------------------------------------------------------------------
    # Story Integration (Step 2 <-> Step 3 Bidirectional Sync)
    # ------------------------------------------------------------------

    def sync_character_to_story(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterStorySyncRequest,
    ) -> CharacterResponse:
        """
        Import or update a Studio `Character` into a Step 2 `Story` without duplicating.
        Preserves existing story relationships and scene references, and optionally adds
        the character to requested `scene_ids`.
        """
        character = self._get_owned_character(user, character_id)
        story = self._get_owned_story(user, payload.story_id)
        ext = CharacterPromptBuilder.extract_extended_metadata(character)

        doc = self.story_repo.build_document_from_orm(story)

        # Match existing story character by linked ID, character.id, or case-insensitive name
        target_story_char: Optional[StoryCharacterData] = None
        for sc in doc.characters:
            if (
                sc.id == str(character.id)
                or (ext.story_character_id and sc.id == ext.story_character_id)
                or sc.name.strip().lower() == character.name.strip().lower()
            ):
                target_story_char = sc
                break

        canonical_appearance = (
            ext.character_bible.canonical_description
            or character.appearance_description
            or ""
        )

        if target_story_char:
            # Update in-place while preserving existing story character ID and relationships
            target_story_char.name = character.name
            target_story_char.role = character.role
            target_story_char.age_description = character.age_description or ""
            target_story_char.personality = list(character.personality or [])
            target_story_char.appearance_description = canonical_appearance
            target_story_char.motivation = character.motivation or ""
            target_story_char.backstory = character.backstory or ""
            story_char_id = target_story_char.id
        else:
            story_char_id = str(character.id)
            rels = [
                CharacterRelationshipData(
                    id=r.id,
                    target_character_id=r.target_character_id,
                    target_character_name=r.target_character_name,
                    relationship_type=r.relationship_type,
                    description=r.description,
                )
                for r in (ext.relationships or [])
            ]
            new_sc = StoryCharacterData(
                id=story_char_id,
                name=character.name,
                role=character.role,
                age_description=character.age_description or "Young adult",
                personality=list(character.personality or []),
                appearance_description=canonical_appearance,
                motivation=character.motivation or "",
                backstory=character.backstory or "",
                relationships=rels,
            )
            doc.characters.append(new_sc)

        # Assign character to requested scenes without duplicating
        if payload.scene_ids:
            requested_set = set(payload.scene_ids)
            for scene in doc.scenes:
                if scene.id in requested_set:
                    if (
                        story_char_id not in scene.characters
                        and character.name not in scene.characters
                    ):
                        scene.characters.append(story_char_id)

        self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=doc,
            create_version=False,
        )

        character.story_id = story.id
        ext.story_character_id = story_char_id
        character.character_metadata = ext.model_dump(mode="json")
        self.db.add(character)
        self.db.commit()

        reloaded = self._get_owned_character(user, character.id)
        return self._serialize_character(reloaded)

    def import_characters_from_story(
        self,
        user: User,
        story_id: uuid.UUID,
    ) -> List[CharacterResponse]:
        """
        Ensure every character in a Step 2 `Story` has a corresponding rich Step 3 `Character`
        in the Character Studio without creating duplicates.
        """
        story = self._get_owned_story(user, story_id)
        doc = self.story_repo.build_document_from_orm(story)
        existing_chars = self.repo.list_for_owner(
            owner_id=user.id,
            project_id=story.project_id,
            limit=500,
        )

        results: List[CharacterResponse] = []
        for sc in doc.characters:
            matched: Optional[Character] = None
            for ch in existing_chars:
                ch_ext = CharacterPromptBuilder.extract_extended_metadata(ch)
                if (
                    str(ch.id) == sc.id
                    or ch_ext.story_character_id == sc.id
                    or ch.name.strip().lower() == sc.name.strip().lower()
                ):
                    matched = ch
                    break

            if matched:
                if not matched.story_id:
                    matched.story_id = story.id
                    self.db.add(matched)
                    self.db.commit()
                reloaded = self._get_owned_character(user, matched.id)
                results.append(self._serialize_character(reloaded))
            else:
                created = self.create_character(
                    user,
                    CharacterCreateRequest(
                        project_id=story.project_id,
                        story_id=story.id,
                        name=sc.name,
                        role=sc.role or "Main character",
                        age_description=sc.age_description or "Young adult",
                        personality=list(sc.personality or []),
                        appearance_description=sc.appearance_description or "",
                        motivation=sc.motivation or "",
                        backstory=sc.backstory or "",
                        style=story.animation_style or "Anime",
                        story_character_id=sc.id,
                        relationships=[
                            CharacterRelationshipEntry(
                                id=r.id,
                                target_character_id=r.target_character_id,
                                target_character_name=r.target_character_name,
                                relationship_type=r.relationship_type,
                                description=r.description or "",
                            )
                            for r in (sc.relationships or [])
                        ],
                    ),
                )
                results.append(created)
        return results

    # ------------------------------------------------------------------
    # Expressions CRUD
    # ------------------------------------------------------------------

    def list_expressions(
        self, user: User, character_id: uuid.UUID
    ) -> List[CharacterExpressionResponse]:
        self._get_owned_character(user, character_id)
        items = self.repo.list_expressions(character_id)
        return [self._serialize_expression(e) for e in items]

    def create_expression(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterExpressionCreateRequest,
    ) -> CharacterExpressionResponse:
        character = self._get_owned_character(user, character_id)
        if payload.asset_id:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
        expr = CharacterExpression(
            character_id=character.id,
            name=payload.name.strip(),
            description=payload.description or "",
            asset_id=payload.asset_id,
            generation_status="completed" if payload.asset_id else "draft",
        )
        self.db.add(expr)
        self.db.commit()
        self.db.refresh(expr)
        return self._serialize_expression(expr)

    def update_expression(
        self,
        user: User,
        expression_id: uuid.UUID,
        payload: CharacterExpressionUpdateRequest,
    ) -> CharacterExpressionResponse:
        expr = self.repo.get_expression_by_id(expression_id)
        if not expr:
            raise NotFoundException("Character expression not found.")
        character = self._get_owned_character(user, expr.character_id)
        if payload.name is not None:
            expr.name = payload.name.strip()
        if payload.description is not None:
            expr.description = payload.description
        if payload.asset_id is not None:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
            expr.asset_id = asset.id
            expr.generation_status = "completed"
        if payload.generation_status is not None:
            expr.generation_status = payload.generation_status
        self.db.add(expr)
        self.db.commit()
        self.db.refresh(expr)
        return self._serialize_expression(expr)

    def delete_expression(self, user: User, expression_id: uuid.UUID) -> None:
        expr = self.repo.get_expression_by_id(expression_id)
        if not expr:
            raise NotFoundException("Character expression not found.")
        self._get_owned_character(user, expr.character_id)
        self.db.delete(expr)
        self.db.commit()

    # ------------------------------------------------------------------
    # Poses CRUD
    # ------------------------------------------------------------------

    def list_poses(
        self, user: User, character_id: uuid.UUID
    ) -> List[CharacterPoseResponse]:
        self._get_owned_character(user, character_id)
        items = self.repo.list_poses(character_id)
        return [self._serialize_pose(p) for p in items]

    def create_pose(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterPoseCreateRequest,
    ) -> CharacterPoseResponse:
        character = self._get_owned_character(user, character_id)
        if payload.asset_id:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
        pose = CharacterPose(
            character_id=character.id,
            name=payload.name.strip(),
            category=payload.category.strip() or "Standing",
            description=payload.description or "",
            asset_id=payload.asset_id,
            generation_status="completed" if payload.asset_id else "draft",
        )
        self.db.add(pose)
        self.db.commit()
        self.db.refresh(pose)
        return self._serialize_pose(pose)

    def update_pose(
        self,
        user: User,
        pose_id: uuid.UUID,
        payload: CharacterPoseUpdateRequest,
    ) -> CharacterPoseResponse:
        pose = self.repo.get_pose_by_id(pose_id)
        if not pose:
            raise NotFoundException("Character pose not found.")
        character = self._get_owned_character(user, pose.character_id)
        if payload.name is not None:
            pose.name = payload.name.strip()
        if payload.category is not None:
            pose.category = payload.category.strip()
        if payload.description is not None:
            pose.description = payload.description
        if payload.asset_id is not None:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
            pose.asset_id = asset.id
            pose.generation_status = "completed"
        if payload.generation_status is not None:
            pose.generation_status = payload.generation_status
        self.db.add(pose)
        self.db.commit()
        self.db.refresh(pose)
        return self._serialize_pose(pose)

    def delete_pose(self, user: User, pose_id: uuid.UUID) -> None:
        pose = self.repo.get_pose_by_id(pose_id)
        if not pose:
            raise NotFoundException("Character pose not found.")
        self._get_owned_character(user, pose.character_id)
        self.db.delete(pose)
        self.db.commit()

    # ------------------------------------------------------------------
    # Outfits CRUD (Changing default outfit never overwrites canonical appearance)
    # ------------------------------------------------------------------

    def list_outfits(
        self, user: User, character_id: uuid.UUID
    ) -> List[CharacterOutfitResponse]:
        self._get_owned_character(user, character_id)
        items = self.repo.list_outfits(character_id)
        return [self._serialize_outfit(o) for o in items]

    def create_outfit(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterOutfitCreateRequest,
    ) -> CharacterOutfitResponse:
        character = self._get_owned_character(user, character_id)
        if payload.asset_id:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
        if payload.is_default:
            self.repo.clear_default_outfits(character.id)
        outfit = CharacterOutfit(
            character_id=character.id,
            name=payload.name.strip(),
            description=payload.description or "",
            color_palette=list(payload.color_palette or []),
            accessories=list(payload.accessories or []),
            asset_id=payload.asset_id,
            is_default=payload.is_default,
            generation_status="completed" if payload.asset_id else "draft",
        )
        self.db.add(outfit)
        self.db.commit()
        self.db.refresh(outfit)
        return self._serialize_outfit(outfit)

    def update_outfit(
        self,
        user: User,
        outfit_id: uuid.UUID,
        payload: CharacterOutfitUpdateRequest,
    ) -> CharacterOutfitResponse:
        outfit = self.repo.get_outfit_by_id(outfit_id)
        if not outfit:
            raise NotFoundException("Character outfit not found.")
        character = self._get_owned_character(user, outfit.character_id)
        if payload.is_default is True:
            self.repo.clear_default_outfits(character.id)
            outfit.is_default = True
        elif payload.is_default is False:
            outfit.is_default = False

        if payload.name is not None:
            outfit.name = payload.name.strip()
        if payload.description is not None:
            outfit.description = payload.description
        if payload.color_palette is not None:
            outfit.color_palette = list(payload.color_palette)
        if payload.accessories is not None:
            outfit.accessories = list(payload.accessories)
        if payload.asset_id is not None:
            asset = self.repo.get_asset_by_id(payload.asset_id)
            if not asset or asset.character_id != character.id:
                raise NotFoundException("Referenced asset does not belong to this character.")
            outfit.asset_id = asset.id
            outfit.generation_status = "completed"
        if payload.generation_status is not None:
            outfit.generation_status = payload.generation_status

        self.db.add(outfit)
        self.db.commit()
        self.db.refresh(outfit)
        return self._serialize_outfit(outfit)

    def delete_outfit(self, user: User, outfit_id: uuid.UUID) -> None:
        outfit = self.repo.get_outfit_by_id(outfit_id)
        if not outfit:
            raise NotFoundException("Character outfit not found.")
        self._get_owned_character(user, outfit.character_id)
        self.db.delete(outfit)
        self.db.commit()

    # ------------------------------------------------------------------
    # Character Image Assets (Upload, Gallery, Canonical Reference, Media)
    # ------------------------------------------------------------------

    def upload_character_asset(
        self,
        user: User,
        character_id: uuid.UUID,
        file_bytes: bytes,
        original_filename: Optional[str] = None,
        asset_type: str = "reference_upload",
        label: Optional[str] = None,
        set_as_canonical_reference: bool = False,
    ) -> CharacterAssetResponse:
        character = self._get_owned_character(user, character_id)
        info = validate_and_inspect_image_bytes(file_bytes)

        asset_id = uuid.uuid4()
        file_reference = self.storage.save_asset_bytes(
            character_id=character.id,
            asset_id=asset_id,
            extension=info.extension,
            data=file_bytes,
        )

        safe_name = (original_filename or f"upload.{info.extension}").split("/")[-1].split("\\")[-1][:200]
        asset = CharacterAsset(
            id=asset_id,
            character_id=character.id,
            owner_id=user.id,
            asset_type=asset_type or "reference_upload",
            file_reference=file_reference,
            prompt=None,
            provider="user_upload",
            generation_status="uploaded",
            asset_metadata={
                "mime_type": info.mime_type,
                "extension": info.extension,
                "width": info.width,
                "height": info.height,
                "size_bytes": info.size_bytes,
                "sha256": info.sha256,
                "original_filename": safe_name,
                "label": label or safe_name,
            },
        )
        self.db.add(asset)

        if set_as_canonical_reference or not character.canonical_reference_asset_id:
            character.canonical_reference_asset_id = asset.id
            ext = CharacterPromptBuilder.extract_extended_metadata(character)
            if str(asset.id) not in ext.character_bible.selected_reference_asset_ids:
                ext.character_bible.selected_reference_asset_ids.insert(0, str(asset.id))
            character.character_metadata = ext.model_dump(mode="json")
            self.db.add(character)

        self.db.commit()
        self.db.refresh(asset)
        return self._serialize_asset(
            asset, canonical_asset_id=character.canonical_reference_asset_id
        )

    def list_character_assets(
        self,
        user: User,
        character_id: uuid.UUID,
        asset_type: Optional[str] = None,
    ) -> List[CharacterAssetResponse]:
        character = self._get_owned_character(user, character_id)
        assets = self.repo.list_assets(character.id, asset_type=asset_type)
        return [
            self._serialize_asset(a, canonical_asset_id=character.canonical_reference_asset_id)
            for a in assets
        ]

    def update_character_asset(
        self,
        user: User,
        asset_id: uuid.UUID,
        payload: CharacterAssetUpdateRequest,
    ) -> CharacterAssetResponse:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Character asset not found.")
        character = self._get_owned_character(user, asset.character_id)

        if payload.asset_type is not None:
            asset.asset_type = payload.asset_type.strip()
        if payload.label is not None:
            meta = dict(asset.asset_metadata or {})
            meta["label"] = payload.label.strip()
            asset.asset_metadata = meta

        if payload.set_as_canonical_reference is True:
            character.canonical_reference_asset_id = asset.id
            ext = CharacterPromptBuilder.extract_extended_metadata(character)
            if str(asset.id) not in ext.character_bible.selected_reference_asset_ids:
                ext.character_bible.selected_reference_asset_ids.insert(0, str(asset.id))
            character.character_metadata = ext.model_dump(mode="json")
            self.db.add(character)

        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return self._serialize_asset(
            asset, canonical_asset_id=character.canonical_reference_asset_id
        )

    def delete_character_asset(self, user: User, asset_id: uuid.UUID) -> None:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Character asset not found.")
        character = self._get_owned_character(user, asset.character_id)
        if character.canonical_reference_asset_id == asset.id:
            character.canonical_reference_asset_id = None
            self.db.add(character)
        self.storage.delete_asset(asset.file_reference)
        self.db.delete(asset)
        self.db.commit()

    def get_asset_for_signed_delivery(self, asset_id: uuid.UUID) -> Tuple[CharacterAsset, bytes]:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Character asset not found.")
        raw = self.storage.read_asset_bytes(asset.file_reference)
        return asset, raw

    # ------------------------------------------------------------------
    # AI Character Image Generation Workflows & Job Tracking
    # ------------------------------------------------------------------

    def _load_reference_images(
        self,
        character: Character,
        requested_asset_ids: Optional[List[str]] = None,
    ) -> List[ReferenceImageInput]:
        ext = CharacterPromptBuilder.extract_extended_metadata(character)
        candidate_ids: List[str] = list(requested_asset_ids or [])
        if not candidate_ids:
            candidate_ids = list(ext.character_bible.selected_reference_asset_ids or [])
        if (
            character.canonical_reference_asset_id
            and str(character.canonical_reference_asset_id) not in candidate_ids
        ):
            candidate_ids.insert(0, str(character.canonical_reference_asset_id))

        refs: List[ReferenceImageInput] = []
        for cid_str in candidate_ids[:3]:
            try:
                aid = uuid.UUID(cid_str)
            except ValueError:
                continue
            asset = self.repo.get_asset_by_id(aid)
            if asset and asset.character_id == character.id:
                try:
                    raw = self.storage.read_asset_bytes(asset.file_reference)
                    mime = (asset.asset_metadata or {}).get("mime_type", "image/png")
                    refs.append(
                        ReferenceImageInput(
                            asset_id=str(asset.id),
                            mime_type=mime,
                            image_bytes=raw,
                        )
                    )
                except Exception:
                    continue
        return refs

    def _persist_generated_artifact(
        self,
        user: User,
        character: Character,
        artifact: GeneratedImageArtifact,
        asset_type: str,
        label: str,
        set_as_canonical: bool = False,
    ) -> CharacterAsset:
        asset_id = uuid.uuid4()
        file_reference = self.storage.save_asset_bytes(
            character_id=character.id,
            asset_id=asset_id,
            extension=artifact.image_info.extension,
            data=artifact.image_bytes,
        )
        asset = CharacterAsset(
            id=asset_id,
            character_id=character.id,
            owner_id=user.id,
            asset_type=asset_type,
            file_reference=file_reference,
            prompt=artifact.prompt,
            provider=artifact.provider,
            generation_status="completed",
            asset_metadata={
                "mime_type": artifact.image_info.mime_type,
                "extension": artifact.image_info.extension,
                "width": artifact.image_info.width,
                "height": artifact.image_info.height,
                "size_bytes": artifact.image_info.size_bytes,
                "sha256": artifact.image_info.sha256,
                "model": artifact.model,
                "view_type": artifact.view_type,
                "label": label,
                "used_reference_asset_ids": artifact.used_reference_asset_ids,
                **artifact.provider_metadata,
            },
        )
        self.db.add(asset)
        if set_as_canonical or not character.canonical_reference_asset_id:
            character.canonical_reference_asset_id = asset.id
            self.db.add(character)
        self.db.flush()
        return asset

    def generate_character_image(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterGenerateImageRequest,
    ) -> CharacterGenerationResultResponse:
        character = self._get_owned_character(user, character_id)
        provider = get_ai_image_provider()
        active_style = payload.style_override or character.style
        provider.ensure_style_supported(active_style)

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else CharacterPromptBuilder.build_prompt(
                character=character,
                generation_type=payload.generation_type,
                style_override=active_style,
                camera_framing=payload.camera_framing,
                background=payload.background,
                user_instructions=payload.user_instructions,
            )
        )

        job = CharacterGenerationJob(
            character_id=character.id,
            owner_id=user.id,
            generation_type=payload.generation_type,
            status="running",
            provider=provider.provider_name,
            prompt=prompt,
            result_metadata={"style": active_style, "model": provider.model_name},
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        refs = self._load_reference_images(character, payload.reference_asset_ids)

        try:
            if payload.generation_type == "portrait":
                artifact = provider.generate_character_portrait(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            elif payload.generation_type == "full_body":
                artifact = provider.generate_full_body_character(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            else:
                artifact = provider.generate_character_concept(
                    prompt=prompt, style=active_style, reference_images=refs
                )

            saved_asset = self._persist_generated_artifact(
                user=user,
                character=character,
                artifact=artifact,
                asset_type=payload.generation_type,
                label=f"{character.name} — {payload.generation_type.replace('_', ' ').title()}",
                set_as_canonical=payload.set_as_canonical_reference,
            )

            job.status = "completed"
            job.result_metadata = {
                "style": active_style,
                "model": provider.model_name,
                "asset_ids": [str(saved_asset.id)],
                "used_reference_asset_ids": artifact.used_reference_asset_ids,
            }
            self.db.add(job)
            self.db.commit()
        except Exception as exc:
            job.status = "failed"
            job.error_message = getattr(exc, "detail", str(exc))
            self.db.add(job)
            self.db.commit()
            raise

        reloaded = self._get_owned_character(user, character.id)
        status_info = get_image_provider_status()
        return CharacterGenerationResultResponse(
            job=CharacterGenerationJobResponse.model_validate(job),
            generated_assets=[
                self._serialize_asset(
                    saved_asset,
                    canonical_asset_id=reloaded.canonical_reference_asset_id,
                )
            ],
            views_requested=[payload.generation_type],
            views_generated=[payload.generation_type],
            complete=True,
            consistency_note=status_info.consistency_disclaimer,
            character=self._serialize_character(reloaded),
        )

    def generate_character_sheet(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterGenerateSheetRequest,
    ) -> CharacterGenerationResultResponse:
        character = self._get_owned_character(user, character_id)
        provider = get_ai_image_provider()
        active_style = payload.style_override or character.style
        provider.ensure_style_supported(active_style)

        prompts_by_view: Dict[str, str] = {}
        if payload.sheet_mode == "combined_sheet":
            views_str = ", ".join(v.replace("_", " ") for v in payload.views)
            combined_prompt = (
                payload.custom_prompt.strip()
                if payload.custom_prompt and payload.custom_prompt.strip()
                else CharacterPromptBuilder.build_prompt(
                    character=character,
                    generation_type="turnaround_sheet",
                    style_override=active_style,
                    view_type="turnaround_sheet",
                    user_instructions=(
                        f"Include the following character sheet views side by side: {views_str}. "
                        f"{payload.user_instructions or ''}"
                    ).strip(),
                )
            )
            prompts_by_view["turnaround_sheet"] = combined_prompt
        else:
            for v in payload.views:
                prompts_by_view[v] = CharacterPromptBuilder.build_prompt(
                    character=character,
                    generation_type="turnaround_sheet",
                    style_override=active_style,
                    view_type=v,
                    user_instructions=payload.user_instructions,
                )

        job = CharacterGenerationJob(
            character_id=character.id,
            owner_id=user.id,
            generation_type="turnaround_sheet",
            status="running",
            provider=provider.provider_name,
            prompt=" | ".join(prompts_by_view.values())[:4000],
            result_metadata={
                "sheet_mode": payload.sheet_mode,
                "views_requested": list(payload.views),
                "style": active_style,
            },
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        refs = self._load_reference_images(character)
        saved_assets: List[CharacterAsset] = []
        views_generated: List[str] = []

        try:
            artifacts = provider.generate_character_turnaround_sheet(
                prompts_by_view=prompts_by_view,
                style=active_style,
                reference_images=refs,
            )
            for artifact in artifacts:
                asset_type = (
                    "turnaround_sheet"
                    if artifact.view_type == "turnaround_sheet"
                    else f"sheet_{artifact.view_type}"
                )
                saved = self._persist_generated_artifact(
                    user=user,
                    character=character,
                    artifact=artifact,
                    asset_type=asset_type,
                    label=f"{character.name} — {artifact.view_type.replace('_', ' ').title()}",
                )
                saved_assets.append(saved)
                views_generated.append(artifact.view_type)

            if payload.sheet_mode == "combined_sheet":
                is_complete = len(saved_assets) >= 1
                effective_generated = list(payload.views) if is_complete else []
            else:
                effective_generated = views_generated
                is_complete = len(effective_generated) == len(payload.views)

            job.status = "completed" if is_complete else "partial"
            job.result_metadata = {
                "sheet_mode": payload.sheet_mode,
                "views_requested": list(payload.views),
                "views_generated": effective_generated,
                "complete": is_complete,
                "asset_ids": [str(a.id) for a in saved_assets],
            }
            self.db.add(job)
            self.db.commit()
        except Exception as exc:
            job.status = "failed"
            job.error_message = getattr(exc, "detail", str(exc))
            job.result_metadata = {
                "sheet_mode": payload.sheet_mode,
                "views_requested": list(payload.views),
                "views_generated": views_generated,
                "complete": False,
                "asset_ids": [str(a.id) for a in saved_assets],
            }
            self.db.add(job)
            self.db.commit()
            raise

        reloaded = self._get_owned_character(user, character.id)
        status_info = get_image_provider_status()
        return CharacterGenerationResultResponse(
            job=CharacterGenerationJobResponse.model_validate(job),
            generated_assets=[
                self._serialize_asset(
                    a, canonical_asset_id=reloaded.canonical_reference_asset_id
                )
                for a in saved_assets
            ],
            views_requested=list(payload.views),
            views_generated=effective_generated,
            complete=is_complete,
            consistency_note=status_info.consistency_disclaimer,
            character=self._serialize_character(reloaded),
        )

    def generate_expression_asset(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterGenerateExpressionRequest,
    ) -> CharacterGenerationResultResponse:
        character = self._get_owned_character(user, character_id)
        provider = get_ai_image_provider()
        provider.ensure_style_supported(character.style)

        expr: Optional[CharacterExpression] = None
        if payload.expression_id:
            expr = self.repo.get_expression_by_id(payload.expression_id)
            if not expr or expr.character_id != character.id:
                raise NotFoundException("Character expression not found.")
        else:
            existing_exprs = self.repo.list_expressions(character.id)
            expr = next(
                (
                    e
                    for e in existing_exprs
                    if e.name.strip().lower() == payload.expression_name.strip().lower()
                ),
                None,
            )
            if not expr:
                expr = CharacterExpression(
                    character_id=character.id,
                    name=payload.expression_name.strip(),
                    description=payload.description or "",
                    generation_status="generating",
                )
                self.db.add(expr)
                self.db.flush()

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else CharacterPromptBuilder.build_prompt(
                character=character,
                generation_type="portrait",
                camera_framing="close-up facial expression portrait",
                expression_name=expr.name,
                expression_description=payload.description or expr.description,
                user_instructions=payload.user_instructions,
            )
        )

        job = CharacterGenerationJob(
            character_id=character.id,
            owner_id=user.id,
            generation_type="expression",
            status="running",
            provider=provider.provider_name,
            prompt=prompt,
            result_metadata={"expression_id": str(expr.id), "expression_name": expr.name},
        )
        expr.generation_status = "generating"
        self.db.add(expr)
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        refs = self._load_reference_images(character)
        try:
            artifact = provider.generate_expressions(
                prompt=prompt,
                expression_name=expr.name,
                style=character.style,
                reference_images=refs,
            )
            saved_asset = self._persist_generated_artifact(
                user=user,
                character=character,
                artifact=artifact,
                asset_type="expression",
                label=f"{character.name} — Expression: {expr.name}",
            )
            expr.asset_id = saved_asset.id
            expr.generation_status = "completed"
            if payload.description:
                expr.description = payload.description
            job.status = "completed"
            job.result_metadata = {
                "expression_id": str(expr.id),
                "expression_name": expr.name,
                "asset_ids": [str(saved_asset.id)],
            }
            self.db.add(expr)
            self.db.add(job)
            self.db.commit()
        except Exception as exc:
            expr.generation_status = "failed"
            job.status = "failed"
            job.error_message = getattr(exc, "detail", str(exc))
            self.db.add(expr)
            self.db.add(job)
            self.db.commit()
            raise

        reloaded = self._get_owned_character(user, character.id)
        status_info = get_image_provider_status()
        return CharacterGenerationResultResponse(
            job=CharacterGenerationJobResponse.model_validate(job),
            generated_assets=[
                self._serialize_asset(
                    saved_asset,
                    canonical_asset_id=reloaded.canonical_reference_asset_id,
                )
            ],
            views_requested=[f"expression:{expr.name}"],
            views_generated=[f"expression:{expr.name}"],
            complete=True,
            consistency_note=status_info.consistency_disclaimer,
            character=self._serialize_character(reloaded),
        )

    def generate_pose_asset(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterGeneratePoseRequest,
    ) -> CharacterGenerationResultResponse:
        character = self._get_owned_character(user, character_id)
        provider = get_ai_image_provider()
        provider.ensure_style_supported(character.style)

        pose: Optional[CharacterPose] = None
        if payload.pose_id:
            pose = self.repo.get_pose_by_id(payload.pose_id)
            if not pose or pose.character_id != character.id:
                raise NotFoundException("Character pose not found.")
        else:
            existing_poses = self.repo.list_poses(character.id)
            pose = next(
                (
                    p
                    for p in existing_poses
                    if p.name.strip().lower() == payload.pose_name.strip().lower()
                ),
                None,
            )
            if not pose:
                pose = CharacterPose(
                    character_id=character.id,
                    name=payload.pose_name.strip(),
                    category=payload.category.strip() or "Standing",
                    description=payload.description or "",
                    generation_status="generating",
                )
                self.db.add(pose)
                self.db.flush()

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else CharacterPromptBuilder.build_prompt(
                character=character,
                generation_type="full_body",
                camera_framing="full-body action pose",
                pose_name=pose.name,
                pose_category=payload.category or pose.category,
                pose_description=payload.description or pose.description,
                user_instructions=payload.user_instructions,
            )
        )

        job = CharacterGenerationJob(
            character_id=character.id,
            owner_id=user.id,
            generation_type="pose",
            status="running",
            provider=provider.provider_name,
            prompt=prompt,
            result_metadata={"pose_id": str(pose.id), "pose_name": pose.name},
        )
        pose.generation_status = "generating"
        self.db.add(pose)
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        refs = self._load_reference_images(character)
        try:
            artifact = provider.generate_pose_variations(
                prompt=prompt,
                pose_name=pose.name,
                style=character.style,
                reference_images=refs,
            )
            saved_asset = self._persist_generated_artifact(
                user=user,
                character=character,
                artifact=artifact,
                asset_type="pose",
                label=f"{character.name} — Pose: {pose.name}",
            )
            pose.asset_id = saved_asset.id
            pose.generation_status = "completed"
            if payload.description:
                pose.description = payload.description
            job.status = "completed"
            job.result_metadata = {
                "pose_id": str(pose.id),
                "pose_name": pose.name,
                "asset_ids": [str(saved_asset.id)],
            }
            self.db.add(pose)
            self.db.add(job)
            self.db.commit()
        except Exception as exc:
            pose.generation_status = "failed"
            job.status = "failed"
            job.error_message = getattr(exc, "detail", str(exc))
            self.db.add(pose)
            self.db.add(job)
            self.db.commit()
            raise

        reloaded = self._get_owned_character(user, character.id)
        status_info = get_image_provider_status()
        return CharacterGenerationResultResponse(
            job=CharacterGenerationJobResponse.model_validate(job),
            generated_assets=[
                self._serialize_asset(
                    saved_asset,
                    canonical_asset_id=reloaded.canonical_reference_asset_id,
                )
            ],
            views_requested=[f"pose:{pose.name}"],
            views_generated=[f"pose:{pose.name}"],
            complete=True,
            consistency_note=status_info.consistency_disclaimer,
            character=self._serialize_character(reloaded),
        )

    def generate_outfit_asset(
        self,
        user: User,
        character_id: uuid.UUID,
        payload: CharacterGenerateOutfitRequest,
    ) -> CharacterGenerationResultResponse:
        character = self._get_owned_character(user, character_id)
        provider = get_ai_image_provider()
        provider.ensure_style_supported(character.style)

        outfit: Optional[CharacterOutfit] = None
        if payload.outfit_id:
            outfit = self.repo.get_outfit_by_id(payload.outfit_id)
            if not outfit or outfit.character_id != character.id:
                raise NotFoundException("Character outfit not found.")
        else:
            existing_outfits = self.repo.list_outfits(character.id)
            outfit = next(
                (
                    o
                    for o in existing_outfits
                    if o.name.strip().lower() == payload.outfit_name.strip().lower()
                ),
                None,
            )
            if not outfit:
                if payload.is_default:
                    self.repo.clear_default_outfits(character.id)
                outfit = CharacterOutfit(
                    character_id=character.id,
                    name=payload.outfit_name.strip(),
                    description=payload.description or "",
                    color_palette=list(payload.color_palette or []),
                    accessories=list(payload.accessories or []),
                    is_default=payload.is_default,
                    generation_status="generating",
                )
                self.db.add(outfit)
                self.db.flush()

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else CharacterPromptBuilder.build_prompt(
                character=character,
                generation_type="full_body",
                camera_framing="full-body costume and wardrobe design",
                outfit_name=outfit.name,
                outfit_description=payload.description or outfit.description,
                outfit_palette=payload.color_palette or list(outfit.color_palette or []),
                outfit_accessories=payload.accessories or list(outfit.accessories or []),
                user_instructions=payload.user_instructions,
            )
        )

        job = CharacterGenerationJob(
            character_id=character.id,
            owner_id=user.id,
            generation_type="outfit",
            status="running",
            provider=provider.provider_name,
            prompt=prompt,
            result_metadata={"outfit_id": str(outfit.id), "outfit_name": outfit.name},
        )
        outfit.generation_status = "generating"
        self.db.add(outfit)
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        refs = self._load_reference_images(character)
        try:
            artifact = provider.generate_outfit_variations(
                prompt=prompt,
                outfit_name=outfit.name,
                style=character.style,
                reference_images=refs,
            )
            saved_asset = self._persist_generated_artifact(
                user=user,
                character=character,
                artifact=artifact,
                asset_type="outfit",
                label=f"{character.name} — Outfit: {outfit.name}",
            )
            outfit.asset_id = saved_asset.id
            outfit.generation_status = "completed"
            if payload.description:
                outfit.description = payload.description
            if payload.color_palette:
                outfit.color_palette = list(payload.color_palette)
            if payload.accessories:
                outfit.accessories = list(payload.accessories)
            if payload.is_default:
                self.repo.clear_default_outfits(character.id)
                outfit.is_default = True
            job.status = "completed"
            job.result_metadata = {
                "outfit_id": str(outfit.id),
                "outfit_name": outfit.name,
                "asset_ids": [str(saved_asset.id)],
            }
            self.db.add(outfit)
            self.db.add(job)
            self.db.commit()
        except Exception as exc:
            outfit.generation_status = "failed"
            job.status = "failed"
            job.error_message = getattr(exc, "detail", str(exc))
            self.db.add(outfit)
            self.db.add(job)
            self.db.commit()
            raise

        reloaded = self._get_owned_character(user, character.id)
        status_info = get_image_provider_status()
        return CharacterGenerationResultResponse(
            job=CharacterGenerationJobResponse.model_validate(job),
            generated_assets=[
                self._serialize_asset(
                    saved_asset,
                    canonical_asset_id=reloaded.canonical_reference_asset_id,
                )
            ],
            views_requested=[f"outfit:{outfit.name}"],
            views_generated=[f"outfit:{outfit.name}"],
            complete=True,
            consistency_note=status_info.consistency_disclaimer,
            character=self._serialize_character(reloaded),
        )

    # ------------------------------------------------------------------
    # Generation Jobs Tracking
    # ------------------------------------------------------------------

    def list_character_jobs(
        self, user: User, character_id: uuid.UUID
    ) -> List[CharacterGenerationJobResponse]:
        self._get_owned_character(user, character_id)
        jobs = self.repo.list_jobs(character_id)
        return [CharacterGenerationJobResponse.model_validate(j) for j in jobs]

    def get_generation_job(
        self, user: User, job_id: uuid.UUID
    ) -> CharacterGenerationJobResponse:
        job = self.repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundException("Character generation job not found.")
        if job.owner_id != user.id:
            raise ForbiddenException("You do not have permission to access this generation job.")
        return CharacterGenerationJobResponse.model_validate(job)
