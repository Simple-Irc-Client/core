<script lang="ts">
  import { creatorCompleted } from "../../services/settings";
  import Creator from '../creator/creator.svelte';
  import Channels from './channels.svelte';
  import Topic from './topic.svelte';
  import Main from './main.svelte';
  import Toolbar from './toolbar.svelte';
  import Users from './users.svelte';
</script>

<section>
  {#if creatorCompleted === false}
    <Creator />
  {/if}
  <div class="flex flex-col">
    <Channels />
    <div class="flex-row">
      <Topic />
      <Main />
      <Toolbar />
    </div>
    <Users />
    </div>
</section>

<style></style>