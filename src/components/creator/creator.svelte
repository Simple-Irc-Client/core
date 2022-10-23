<script lang="ts">
import { nick } from "../../services/settings";
import CreatorNick from '../../components/creator/nick/nick.svelte';
</script>

<section class="relative">
{#if nick === ''}
    <CreatorNick />
{/if}
</section>

<style></style>