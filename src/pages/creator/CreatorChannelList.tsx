import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { useChannelListStore } from "../../store/channelsList";
import { useSettingsStore } from "../../store/settings";

const CreatorChannelList = () => {
  const { t } = useTranslation();

  const channels = useChannelListStore((state) => state.channels);
  const setCreatorCompleted = useSettingsStore(
    (state) => state.setCreatorCompleted
  );

  const onSkip = () => {
    setCreatorCompleted(true);
  };

  const onJoin = () => {
    // TODO join
    setCreatorCompleted(true);
  };

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: t("creator.channels.column.name") ?? "Name",
      width: 150,
    },
    {
      field: "users",
      headerName: t("creator.channels.column.users") ?? "Users",
      width: 100,
    },
    {
      field: "topic",
      headerName: t("creator.channels.column.topic") ?? "Topic",
      width: 500,
      sortable: false,
    },
  ];

  return (
    <>
      <Typography component="h1" variant="h5">
        {t("creator.channels.title")}
      </Typography>
      <Box component="form" sx={{ mt: 3, width: "100%" }}>
        <div style={{ display: "flex", height: 350, width: "100%" }}>
          <DataGrid
            rows={channels.length > 10 ? channels : []}
            columns={columns}
            pageSize={50}
            rowsPerPageOptions={[50]}
            checkboxSelection
            getRowId={(row) => row.name}
            initialState={{
              sorting: {
                sortModel: [{ field: "users", sort: "desc" }],
              },
            }}
            localeText={{
              noRowsLabel: t("creator.channels.loading") ?? "No rows",
            }}
          />
        </div>
        <Button
          onClick={onSkip}
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          {t("creator.channels.button.skip")}
        </Button>
        <Button
          onClick={onJoin}
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          {t("creator.channels.button.join")}
        </Button>
      </Box>
    </>
  );
};

export default CreatorChannelList;
