import { v4 as uuid } from 'uuid/v4';
import db from '../db';
import * as store from '../store';
import * as actions from '../actions/actions';
import { CollectionsArray } from '../../types';

// @ts-expect-error ts-migrate(2339) FIXME: Property 'api' does not exist on type 'Window & ty... Remove this comment to see the full error message
const { api } = window;

api.receive('add-collection', (collectionData: any) => {
  // Add parsed text file to db
  collectionsController.addCollectionToIndexedDb(JSON.parse(collectionData));
  collectionsController.getCollections();
});

const collectionsController = {
  addCollectionToIndexedDb(collection: CollectionsArray): void {
    db.table('collections')
      .put(collection)
      .catch((err: string) => console.log('Error in addToCollection', err));
  },

  deleteCollectionFromIndexedDb(id: string): void {
    db.table('collections')
      .delete(id)
      .catch((err: string) => console.log('Error in deleteFromCollection', err));
  },

  updateCollectionInIndexedDb(collection: CollectionsArray): void {
    collectionsController.deleteCollectionFromIndexedDb(collection.id);
    collectionsController.addCollectionToIndexedDb(collection);
  },

  getCollections(): void {
    db.table('collections')
      .toArray()
      .then((collections: CollectionsArray[] ) => {
        collections.forEach((collection: CollectionsArray) => {
          collection.createdAt = new Date(collection.createdAt);
        });
        const collectionsArr = collections.sort(
          (a: CollectionsArray, b: CollectionsArray) => b.createdAt.valueOf() - a.createdAt.valueOf()
        );
        store.default.dispatch(actions.getCollections(collectionsArr));
        console.log('collections', collectionsArr);
      })
      .catch((err: string) => console.log('Error in getCollection s', err));
  },

  collectionNameExists(obj: CollectionsArray): Promise<boolean> {
    const { name } = obj;
    return new Promise((resolve, reject) => {
      // resolve and reject are functions!
      db.table('collections')
        .where('name')
        .equalsIgnoreCase(name)
        .first((foundCollection: boolean) => !!foundCollection)
        .then((found: boolean) => resolve(found))
        .catch((error: Record<string, undefined>) => {
          console.error(error.stack || error);
          reject(error);
        });
    });
  },

  exportCollection(id: string): void {
    db.table('collections')
      .where('id')
      .equals(id)
      .first((foundCollection: CollectionsArray) => {
        // change name and id of collection to satisfy uniqueness requirements of db
        foundCollection.name += ' import';
        console.log('foundCollection.id', foundCollection.id);
        foundCollection.id = uuid();
        console.log('foundCollection.id', foundCollection.id);
        
        api.send('export-collection', { collection: foundCollection });
      })
      .catch((error: Record<string, undefined>) => {
        console.error(error.stack || error);
        // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'reject'.
        reject(error);
      });
  },

  importCollection(collection: CollectionsArray): Promise<string> {
    return new Promise((resolve) => {
      api.send('import-collection', collection);
      api.receive('add-collection', (...args: CollectionsArray[]) => {
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'data' does not exist on type 'any[]'.
        collectionsController.addCollectionToIndexedDb(JSON.parse(JSON.stringify(args.data)));
        collectionsController.getCollections();
      
        resolve('okie dokie');
      });
    });
  },
};

export default collectionsController;

